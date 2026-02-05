/**
 * E2E Test Server Runner
 * Starts a simple HTTP server for E2E testing
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 18791;
const BUILD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../dist/a2ui-react');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function serveFile(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    // Parse URL
    const urlPath = new URL(req.url || '', `http://${req.headers.host}`).pathname;
    const filePath = path.join(BUILD_DIR, urlPath === '/' ? '/index.html' : urlPath);

    // Check if file exists
    if (!(await exists(filePath))) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    const content = await fs.readFile(filePath);

    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(content);
  } catch (error) {
    console.error('Error serving file:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('500 Internal Server Error');
  }
}

const server = http.createServer(serveFile);

server.listen(PORT, () => {
  console.log(`✅ E2E Test Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving from: ${BUILD_DIR}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { server };
