import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { PORT, KARABINER_JSON, USER_KARABINER_JSON, RULES_TS, VISUALIZER_DIR, readKarabinerJson, parseRulesConfig, generateRulesTs, writeRulesTs } from './config.mjs';
import { analyze } from './analyze.mjs';
import { serveStatic } from './static.mjs';

const PROJECT_ROOT = path.resolve(VISUALIZER_DIR, '..');

// Best-effort: query macOS KnowledgeC (Screen Time) DB for most used apps by bundle
async function getScreenTimeTopApps(days = 7, limit = 15) {
  const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Knowledge', 'knowledgeC.db');
  const exists = fs.existsSync(dbPath);
  if (!exists) return { apps: [], note: 'Screen Time DB not accessible' };

  const sinceSeconds = Math.floor((Date.now() - days * 24 * 3600 * 1000) / 1000);
  // Query adapted to count app in-foreground events. This may require Full Disk Access.
  const sql = `
    SELECT
      ZSTRUCTUREDMETADATA.ZBUNDLEID as bundle,
      COUNT(*) as cnt
    FROM ZOBJECT
    JOIN ZSTRUCTUREDMETADATA ON ZOBJECT.ZSTRUCTUREDMETADATA = ZSTRUCTUREDMETADATA.Z_PK
    WHERE ZSTREAMNAME = 'com.apple.mobiletimer.app.in.foreground'
       OR ZSTREAMNAME = 'com.apple.runningboard.assertions'
       OR ZSTREAMNAME = 'com.apple.appusage.ApplicationUsage'
    AND ZOBJECT.ZSTARTDATE > ${sinceSeconds}
    GROUP BY bundle
    ORDER BY cnt DESC
    LIMIT ${limit};`;

  return new Promise((resolve) => {
    exec(`sqlite3 ${JSON.stringify(dbPath)} ${JSON.stringify(sql)}`, (err, stdout) => {
      if (err) {
        resolve({ apps: [], note: 'Permission required or query failed' });
        return;
      }
      const lines = String(stdout || '').trim().split('\n').filter(Boolean);
      const apps = lines.map(line => {
        const [bundle, cnt] = line.split('|');
        return { bundle: bundle || '', count: Number(cnt || 0) };
      }).filter(a => a.bundle);
      resolve({ apps });
    });
  });
}

// Utility: list installed apps by scanning standard folders
async function listInstalledApps() {
  const dirs = [
    '/Applications',
    '/System/Applications',
    path.join(os.homedir(), 'Applications')
  ];

  const seen = new Set();
  const apps = [];

  for (const dir of dirs) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && ent.name.endsWith('.app')) {
          const fullPath = path.join(dir, ent.name);
          // Derive a human name from folder name (strip .app)
          const base = ent.name.replace(/\.app$/i, '');
          if (!seen.has(base)) {
            seen.add(base);
            apps.push({ name: base, path: fullPath });
          }
        }
      }
    } catch (e) {
      // Ignore missing dirs
    }
  }

  // Sort by name client expects sorted
  apps.sort((a, b) => a.name.localeCompare(b.name));
  return apps;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');

    // CORS headers for API requests
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200).end();
        return;
      }

    if (url.pathname === '/api/apps' && req.method === 'GET') {
      const apps = await listInstalledApps();
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(apps));
      return;
    }

    // Standalone handler for screentime (outside header block for consistency)
    if (url.pathname === '/api/screentime' && req.method === 'GET') {
      try {
        const top = await getScreenTimeTopApps();
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(top));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ apps: [], note: 'Unavailable' }));
      }
      return;
    }
    }

    if (url.pathname === '/api/data') {
      const json = readKarabinerJson();
      if (!json) {
        res
          .writeHead(500, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: `Could not read karabiner.json at ${KARABINER_JSON}` }));
        return;
      }
      const result = analyze(json);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/config') {
      if (req.method === 'GET') {
        // Get current configuration
        const config = parseRulesConfig();
        if (!config) {
          res
            .writeHead(500, { 'Content-Type': 'application/json' })
            .end(JSON.stringify({ error: `Could not read rules.ts at ${RULES_TS}` }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(config));
        return;
      }
      
      if (req.method === 'POST') {
        // Save configuration
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            const config = JSON.parse(body);
            console.log('[POST /api/config] Received config');
            const rulesContent = generateRulesTs(config);
            const success = writeRulesTs(rulesContent);
            
            if (!success) {
              res
                .writeHead(500, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ error: 'Failed to write rules.ts' }));
              return;
            }

            // Build karabiner.json by running the project build script
            exec('npm run build', { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
              if (err) {
                console.error('[build] Error:', err.message);
                console.error('[build] Stderr:', stderr);
                res
                  .writeHead(500, { 'Content-Type': 'application/json' })
                  .end(JSON.stringify({ error: 'rules.ts saved, but failed to build karabiner.json', detail: err.message }));
                return;
              }
              console.log('[build] Success');

              // After successful build, copy the generated karabiner.json to the user's Karabiner config path
              try {
                const targetDir = path.dirname(USER_KARABINER_JSON);
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                }
                // Always copy from the freshly built file in the project root.
                // KARABINER_JSON may point to the user's file (or another location) based on startup state.
                const builtJson = path.join(PROJECT_ROOT, 'karabiner.json');
                fs.copyFileSync(builtJson, USER_KARABINER_JSON);
                console.log(`[apply] Copied ${builtJson} -> ${USER_KARABINER_JSON}`);
              } catch (copyErr) {
                console.error('[apply] Failed to copy karabiner.json to user config:', copyErr);
                res.writeHead(500, { 'Content-Type': 'application/json' })
                  .end(JSON.stringify({ success: false, error: 'Built karabiner.json but failed to apply to user config path', detail: String(copyErr) }));
                return;
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ success: true, message: 'Configuration saved, built, and applied to Karabiner config' }));
            });
          } catch (error) {
            res
              .writeHead(400, { 'Content-Type': 'application/json' })
              .end(JSON.stringify({ error: 'Invalid JSON in request body', detail: error.message }));
          }
        });
        return;
      }
    }

    serveStatic(req, res);
  } catch (e) {
    const detail = e && e.stack ? e.stack : String(e);
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Server error', detail }));
  }
});

server.listen(PORT, () => {
  console.log(`Karabiner Configuration Editor running at http://localhost:${PORT}`);
  console.log(`Reading data from: ${KARABINER_JSON}`);
  console.log(`Managing configuration: ${RULES_TS}`);
});
