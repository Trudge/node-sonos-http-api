import crypto = require('node:crypto');
import fs = require('node:fs');
import path = require('node:path');
import { execFile } from 'node:child_process';
import fileDuration = require('../helpers/file-duration');
import settings = require('../../src/settings');
import logger = require('sonos-discovery/lib/helpers/logger');

interface TtsResult {
  duration: number;
  uri: string;
}

async function macSay(phrase: string, voice?: string): Promise<TtsResult | undefined> {
  if (!settings.macSay) {
    return undefined;
  }

  const configuredRate = settings.macSay.rate || 'default';
  const selectedVoice = voice || settings.macSay.voice;
  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const safeRate = /^\d+$/.test(String(configuredRate)) ? String(configuredRate) : '';
  const safeVoice = String(selectedVoice || 'default').replace(/[^A-Za-z0-9_.-]/g, '_');
  const filename = `macSay-${phraseHash}-${safeRate || 'default'}-${safeVoice}.m4a`;
  const filepath = path.resolve(settings.webroot, 'tts', filename);
  const expectedUri = `/tts/${filename}`;

  try {
    fs.accessSync(filepath, fs.constants.R_OK);
    const duration = await fileDuration(filepath);
    return { duration, uri: expectedUri };
  } catch (_error) {
    logger.info(`announce file for phrase "${phrase}" does not seem to exist, downloading`);
  }

  const args: string[] = [];
  if (selectedVoice) {
    args.push('-v', selectedVoice);
  }
  if (safeRate) {
    args.push('-r', safeRate);
  }
  args.push('-o', filepath, phrase);

  await new Promise<void>((resolve, reject) => {
    execFile('say', args, { timeout: 30000 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const duration = await fileDuration(filepath);
  return { duration, uri: expectedUri };
}

export = macSay;
