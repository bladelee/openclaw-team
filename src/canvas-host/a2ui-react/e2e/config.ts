/**
 * E2E Test Server
 * Simple HTTP server for testing A2UI React build
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 18790;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.resolve(HERE, '../../dist/a2ui-react');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

async function serveFile(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const urlPath = req.url === '/' ? '/index.html' : (req.url || '/');
    const filePath = path.join(BUILD_DIR, urlPath);

    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext as keyof typeof MIME_TYPES] || 'application/octet-stream';

    const content = await fs.readFile(filePath);

    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found');
  }
}

const server = http.createServer(serveFile);

server.listen(PORT, () => {
  console.log(`E2E Test Server running at http://localhost:${PORT}`);
});

export { server };
