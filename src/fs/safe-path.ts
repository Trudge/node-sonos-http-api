import path = require('path');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus']);

function badRequest(message: string): Error {
  const err: any = new Error(message);
  err.statusCode = 400;
  return err;
}

function safeComponent(value: unknown, fallback = 'default'): string {
  const cleaned = String(value == null ? '' : value).replace(/[^A-Za-z0-9_.-]/g, '_');
  return cleaned || fallback;
}

function resolveClipPath(clipsDir: string, name: string): { fullPath: string; filename: string } {
  if (typeof name !== 'string' || name.length === 0) {
    throw badRequest('Missing clip filename');
  }

  let decoded: string;
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

export { safeComponent, resolveClipPath, AUDIO_EXTENSIONS, badRequest };
