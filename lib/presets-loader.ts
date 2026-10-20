import fs = require('node:fs');
import util = require('node:util');
import path = require('node:path');
import logger = require('sonos-discovery/lib/helpers/logger');
import tryLoadJson = require('./helpers/try-load-json');
import settings = require('../src/settings');

const PRESETS_PATH = settings.presetDir;
const PRESETS_FILENAME = path.join(__dirname, '..', 'presets.json');
const presets: Record<string, unknown> = {};

function readPresetsFromDir(target: Record<string, unknown>, presetPath: string): void {
  let files: string[];
  try {
    files = fs.readdirSync(presetPath);
  } catch (error) {
    const err = error as Error;
    logger.warn(`Could not find dir ${presetPath}, are you sure it exists?`);
    logger.warn(err.message);
    return;
  }

  files
    .map((name) => {
      const fullPath = path.join(presetPath, name);
      return { name, fullPath, stat: fs.statSync(fullPath) };
    })
    .filter((file) => !file.stat.isDirectory()
      && !file.name.startsWith('.')
      && file.name.endsWith('.json'))
    .forEach((file) => {
      const presetName = file.name.replace(/\.json/i, '');
      const preset = tryLoadJson(file.fullPath);
      if (Object.keys(preset).length === 0) {
        logger.warn(`could not parse preset file ${file.name}, please make sure syntax conforms with JSON5.`);
        return;
      }
      target[presetName] = preset;
    });
}

function readPresetsFromFile(target: Record<string, unknown>, filename: string): void {
  try {
    const presetStat = fs.statSync(filename);
    if (!presetStat.isFile()) {
      return;
    }

    const filePresets = tryLoadJson(filename);
    Object.keys(filePresets).forEach((presetName) => {
      target[presetName] = filePresets[presetName];
    });

    logger.warn('You are using a presets.json file! '
      + 'Consider migrating your presets into the presets/ '
      + 'folder instead, and enjoy auto-reloading of presets when you change them');
  } catch (_error) {
    logger.debug('no presets.json file exists, skipping');
  }
}

function initPresets(): void {
  Object.keys(presets).forEach((presetName) => {
    delete presets[presetName];
  });
  readPresetsFromFile(presets, PRESETS_FILENAME);
  readPresetsFromDir(presets, PRESETS_PATH);

  logger.info('Presets loaded:', util.inspect(presets, { depth: null }));
}

initPresets();

let watchTimeout: NodeJS.Timeout | undefined;
try {
  fs.watch(PRESETS_PATH, { persistent: false }, () => {
    if (watchTimeout) clearTimeout(watchTimeout);
    watchTimeout = setTimeout(initPresets, 200);
  });
} catch (error) {
  const err = error as Error;
  logger.warn(`Could not start watching dir ${PRESETS_PATH}, will not auto reload any presets. Make sure the dir exists`);
  logger.warn(err.message);
}

export = presets;
