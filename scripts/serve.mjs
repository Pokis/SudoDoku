import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

export function createStaticServer(root = process.cwd()) {
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = normalize(join(root, relativePath));
    if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('sw.js') ? 'no-cache' : 'no-store',
    });
    createReadStream(filePath).pipe(response);
  });
}

function listenOnce(server, port, host) {
  return new Promise((resolveListen, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

export async function listenOnAvailablePort(server, startPort = 4173, host = '127.0.0.1', onRetry = () => {}) {
  const firstPort = Number(startPort);
  if (!Number.isInteger(firstPort) || firstPort < 1 || firstPort > 65535) throw new RangeError('PORT must be an integer between 1 and 65535');
  for (let port = firstPort; port <= 65535; port += 1) {
    try {
      return await listenOnce(server, port, host);
    } catch (error) {
      if (error?.code !== 'EADDRINUSE' || port === 65535) throw error;
      onRetry(port, port + 1);
    }
  }
  throw new Error('No available port found');
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] || '')) {
  const requestedPort = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);
  const host = '127.0.0.1';
  const server = createStaticServer();
  const port = await listenOnAvailablePort(server, requestedPort, host, (busy, next) => {
    console.warn(`Port ${busy} is busy; trying ${next}…`);
  });
  console.log(`Sudodoku is ready at http://${host}:${port}`);
}
