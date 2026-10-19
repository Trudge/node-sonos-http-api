import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('settings loads APP_ROOT and user settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sonos-settings-'));
  fs.mkdirSync(path.join(root, 'static'), { recursive: true });
  fs.mkdirSync(path.join(root, 'presets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'cache'), { recursive: true });
  fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({
    port: 5999,
    ip: '127.0.0.1',
    announceVolume: 25
  }));

  process.env.APP_ROOT = root;
  const settings = require('../src/settings');
  assert.strictEqual(settings.port, 5999);
  assert.strictEqual(settings.ip, '127.0.0.1');
  assert.strictEqual(settings.announceVolume, 25);
  assert.strictEqual(settings.webroot, path.join(root, 'static'));
  assert.ok(fs.existsSync(path.join(root, 'static', 'tts')));

  fs.rmSync(root, { recursive: true, force: true });
});
