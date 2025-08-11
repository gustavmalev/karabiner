import fs from 'fs';
import path from 'path';
import { STATIC_DIR } from './config.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function safeJoin(root, p) {
  const resolved = path.join(root, p);
  if (!resolved.startsWith(root)) return null; // path traversal guard
  return resolved;
}

function serveStatic(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname = url.pathname;
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = safeJoin(STATIC_DIR, pathname);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404).end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    const type = MIME[ext] || 'text/plain; charset=utf-8';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500).end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(data);
    });
  });
}

export { serveStatic };
