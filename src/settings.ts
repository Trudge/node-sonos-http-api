import fs = require('fs');
import path = require('path');
import type { Settings } from './types/settings';

const logger = require('sonos-discovery/lib/helpers/logger');
const tryLoadJson = require('../lib/helpers/try-load-json');

function merge(target: any, source: any): void {
  Object.keys(source).forEach((key) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return;
    }
    if ((Object.getPrototypeOf(source[key]) === Object.prototype) && (target[key] !== undefined)) {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
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
} catch (err) {
  // Missing settings file is normal; defaults are used.
}

if (!fs.existsSync(settings.webroot + '/tts/')) {
  fs.mkdirSync(settings.webroot + '/tts/', { recursive: true });
}

if (!fs.existsSync(settings.cacheDir)) {
  try {
    fs.mkdirSync(settings.cacheDir, { recursive: true });
  } catch (err) {
    logger.warn(`Could not create cache directory ${settings.cacheDir}, please create it manually for all features to work.`);
  }
}

export = settings;
