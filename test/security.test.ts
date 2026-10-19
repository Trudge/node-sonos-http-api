'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { safeComponent, resolveClipPath } = require('../src/fs/safe-path');

const clipsDir = path.join(__dirname, '..', 'static', 'clips');

test('safeComponent removes path and shell metacharacters', () => {
  assert.strictEqual(safeComponent('../../etc/passwd'), '.._.._etc_passwd');
  assert.strictEqual(safeComponent('voice"; touch /tmp/pwned; #'), 'voice___touch__tmp_pwned___');
  assert.strictEqual(safeComponent('', 'default'), 'default');
});

test('resolveClipPath only accepts audio files in the clips directory', () => {
  const resolved = resolveClipPath(clipsDir, 'sample_clip.mp3');
  assert.strictEqual(resolved.filename, 'sample_clip.mp3');
  assert.strictEqual(resolved.fullPath, path.join(clipsDir, 'sample_clip.mp3'));

  assert.throws(() => resolveClipPath(clipsDir, '../../etc/passwd'));
  assert.throws(() => resolveClipPath(clipsDir, '/etc/passwd'));
  assert.throws(() => resolveClipPath(clipsDir, 'config/settings.json'));
  assert.throws(() => resolveClipPath(clipsDir, 'sample_clip.txt'));
});

test('macOS TTS provider never uses a shell', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib/tts-providers/mac-os.ts'), 'utf8');
  assert.match(source, /execFile\(/);
  assert.doesNotMatch(source, /\bexec\(/);
});

test('VoiceRSS uses HTTPS', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib/tts-providers/voicerss.ts'), 'utf8');
  assert.match(source, /https:\/\/api\.voicerss\.org/);
});
