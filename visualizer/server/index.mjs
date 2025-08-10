import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { PORT, KARABINER_JSON, USER_KARABINER_JSON, RULES_TS, VISUALIZER_DIR, readKarabinerJson, parseRulesConfig, generateRulesTs, writeRulesTs } from './config.mjs';
import { analyze } from './analyze.mjs';
import { serveStatic } from './static.mjs';

const PROJECT_ROOT = path.resolve(VISUALIZER_DIR, '..');

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
            exec('yarn build', { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
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
