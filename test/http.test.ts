import test from 'node:test';
import assert from 'node:assert';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
      return;
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('server did not become ready');
}

function basic(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

test('HTTP auth, CORS, methods, headers, and rate limiting', async () => {
  const port = await freePort();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sonos-http-test-'));
  fs.mkdirSync(path.join(root, 'static'), { recursive: true });
  fs.mkdirSync(path.join(root, 'presets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'cache'), { recursive: true });
  fs.writeFileSync(path.join(root, 'static', 'index.html'), '<h1>Sonos API</h1>');
  fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({
    port,
    ip: '127.0.0.1',
    auth: { username: 'user', password: 'pass' },
    cors: ['http://allowed.example']
  }));

  const child = spawn(process.execPath, ['--import', 'tsx', 'server.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, APP_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout?.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk) => { output += chunk.toString(); });

  const base = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(base, child);

    const noAuth = await fetch(`${base}/`);
    assert.strictEqual(noAuth.status, 401);
    assert.strictEqual(noAuth.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(noAuth.headers.get('x-frame-options'), 'DENY');

    const staticNoAuth = await fetch(`${base}/index.html`);
    assert.strictEqual(staticNoAuth.status, 401);

    const authorized = await fetch(`${base}/`, {
      headers: { Authorization: basic('user', 'pass') }
    });
    assert.strictEqual(authorized.status, 200);
    assert.match(authorized.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.match(await authorized.text(), /Sonos API/);

    const allowedCors = await fetch(`${base}/`, {
      headers: {
        Authorization: basic('user', 'pass'),
        Origin: 'http://allowed.example'
      }
    });
    assert.strictEqual(allowedCors.headers.get('access-control-allow-origin'), 'http://allowed.example');

    const deniedCors = await fetch(`${base}/`, {
      headers: {
        Authorization: basic('user', 'pass'),
        Origin: 'http://evil.example'
      }
    });
    assert.strictEqual(deniedCors.headers.get('access-control-allow-origin'), null);

    const options = await fetch(`${base}/zones`, {
      method: 'OPTIONS',
      headers: {
        Authorization: basic('user', 'pass'),
        Origin: 'http://allowed.example'
      }
    });
    assert.strictEqual(options.status, 204);

    const post = await fetch(`${base}/zones`, { method: 'POST' });
    assert.strictEqual(post.status, 405);

    let saw429 = false;
    for (let i = 0; i < 20; i += 1) {
      const failed = await fetch(`${base}/`, {
        headers: { Authorization: basic('user', 'wrong') }
      });
      if (failed.status === 429) {
        saw429 = true;
        break;
      }
    }
    assert.strictEqual(saw429, true);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (child.exitCode === null) child.kill('SIGKILL');
    fs.rmSync(root, { recursive: true, force: true });
  }

  assert.match(output, /http server listening/);
});
