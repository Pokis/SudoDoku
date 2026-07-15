import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createStaticServer, listenOnAvailablePort } from '../scripts/serve.mjs';

const close = (server) => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));

test('local server advances to the next free port when its starting port is busy', async () => {
  const occupied = createServer();
  await new Promise((resolveListen, reject) => occupied.once('error', reject).listen(0, '127.0.0.1', resolveListen));
  const startingPort = occupied.address().port;
  assert.ok(startingPort < 65535, 'The reserved test port must leave room for fallback');

  const server = createStaticServer();
  const retries = [];
  try {
    const selectedPort = await listenOnAvailablePort(server, startingPort, '127.0.0.1', (busy, next) => retries.push({ busy, next }));
    assert.ok(selectedPort > startingPort, 'The occupied starting port must be skipped');
    assert.deepEqual(retries[0], { busy:startingPort, next:startingPort + 1 });
    const response = await fetch(`http://127.0.0.1:${selectedPort}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Sudodoku/);
  } finally {
    await close(server).catch(() => {});
    await close(occupied).catch(() => {});
  }
});
