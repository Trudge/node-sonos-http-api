'use strict';
const path = require('path');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus']);

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function safeComponent(value, fallback = 'default') {
  const cleaned = String(value == null ? '' : value).replace(/[^A-Za-z0-9_.-]/g, '_');
  return cleaned || fallback;
}

function resolveClipPath(clipsDir, name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw badRequest('Missing clip filename');
  }

  let decoded;
  try {
    decoded = decodeURIComponent(name);
  } catch (err) {
    throw badRequest('Invalid clip filename encoding');
  }

  const base = path.basename(decoded);
  const fullPath = path.resolve(clipsDir, base);
  if (path.dirname(fullPath) !== path.resolve(clipsDir)) {
    throw badRequest('Clip path escapes the clips directory');
  }
  if (!AUDIO_EXTENSIONS.has(path.extname(base).toLowerCase())) {
    throw badRequest('Unsupported clip file type');
  }
  return { fullPath, filename: base };
}

module.exports = { safeComponent, resolveClipPath, AUDIO_EXTENSIONS, badRequest };
