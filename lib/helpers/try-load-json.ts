import fs = require('node:fs');
import JSON5 = require('json5');
import logger = require('sonos-discovery/lib/helpers/logger');

function tryLoadJson(filePath: string): Record<string, unknown> {
  try {
    const fileContent = fs.readFileSync(filePath);
    return JSON5.parse(fileContent.toString());
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      logger.info(`Could not find file ${filePath}`);
    } else {
      logger.warn(`Could not read file ${filePath}, ignoring.`, err);
    }
  }
  return {};
}

export = tryLoadJson;
