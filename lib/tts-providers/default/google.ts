import crypto = require('node:crypto');
import fs = require('node:fs');
import path = require('node:path');
import fileDuration = require('../../helpers/file-duration');
import settings = require('../../../src/settings');
import logger = require('sonos-discovery/lib/helpers/logger');
import { safeComponent } from '../../../src/fs/safe-path';

interface TtsResult {
  duration: number;
  uri: string;
}

async function google(phrase: string, language?: string): Promise<TtsResult> {
  const selectedLanguage = language || 'en';
  const ttsRequestUrl = `https://translate.google.com/translate_tts?client=tw-ob&tl=${encodeURIComponent(selectedLanguage)}&q=${encodeURIComponent(phrase)}`;

  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const filename = `google-${phraseHash}-${safeComponent(selectedLanguage, 'en')}.mp3`;
  const filepath = path.resolve(settings.webroot, 'tts', filename);
  const expectedUri = `/tts/${filename}`;

  try {
    fs.accessSync(filepath, fs.constants.R_OK);
    const duration = await fileDuration(filepath);
    return { duration, uri: expectedUri };
  } catch (_error) {
    logger.info(`announce file for phrase "${phrase}" does not seem to exist, downloading`);
  }

  const response = await fetch(ttsRequestUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36'
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Download from google TTS failed with status ${response.status}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    throw new Error('Google TTS returned an empty audio response');
  }
  await fs.promises.writeFile(filepath, audio);
  const duration = await fileDuration(filepath);
  return { duration, uri: expectedUri };
}

export = google;
