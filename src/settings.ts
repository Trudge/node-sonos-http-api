import fs = require('node:fs');
import path = require('node:path');
import type { Settings } from './types/settings';

import logger = require('sonos-discovery/lib/helpers/logger');
import tryLoadJson = require('../lib/helpers/try-load-json');

type ConfigObject = Record<string, unknown>;

function isRecord(value: unknown): value is ConfigObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge(target: ConfigObject, source: ConfigObject): void {
  Object.entries(source).forEach(([key, value]) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return;
    }
    const existing = target[key];
    if (isRecord(value) && isRecord(existing)) {
      merge(existing, value);
    } else {
      target[key] = value;
    }
  });
}

function defaultAppRoot(): string {
  const parent = path.resolve(__dirname, '..');
  if (path.basename(parent) === 'dist') {
    return path.resolve(parent, '..');
  }
  return parent;
}

const APP_ROOT = process.env.APP_ROOT || defaultAppRoot();

const settings: Settings = {
  port: 5005,
  ip: '0.0.0.0',
  securePort: 5006,
  cacheDir: path.resolve(APP_ROOT, 'cache'),
  webroot: path.resolve(APP_ROOT, 'static'),
  presetDir: path.resolve(APP_ROOT, 'presets'),
  announceVolume: 40
};

const settingsFileFullPath = path.resolve(APP_ROOT, 'settings.json');
const userSettings = tryLoadJson(settingsFileFullPath);
merge(settings, userSettings);

try {
  const mode = fs.statSync(settingsFileFullPath).mode & 0o777;
  if (mode & 0o077) {
    logger.warn(`settings.json is accessible by group/others (mode ${mode.toString(8)}); it may contain credentials. Run: chmod 600 settings.json`);
  }
} catch (_err) {
  // Missing settings file is normal; defaults are used.
}

const ttsDir = path.join(settings.webroot, 'tts');
if (!fs.existsSync(ttsDir)) {
  try {
    fs.mkdirSync(ttsDir, { recursive: true });
  } catch (_err) {
    logger.warn(`Could not create TTS directory ${ttsDir}, please create it manually for all features to work.`);
  }
}

if (!fs.existsSync(settings.cacheDir)) {
  try {
    fs.mkdirSync(settings.cacheDir, { recursive: true });
  } catch (_err) {
    logger.warn(`Could not create cache directory ${settings.cacheDir}, please create it manually for all features to work.`);
  }
}

export = settings;
