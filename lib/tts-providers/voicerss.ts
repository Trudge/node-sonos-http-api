import crypto = require('node:crypto');
import fs = require('node:fs');
import path = require('node:path');
import fileDuration = require('../helpers/file-duration');
import settings = require('../../src/settings');
import { safeComponent } from '../../src/fs/safe-path';

interface TtsResult {
  duration: number;
  uri: string;
}

async function voicerss(phrase: string, language?: string): Promise<TtsResult | undefined> {
  if (!settings.voicerss) {
    return undefined;
  }

  const selectedLanguage = language || 'en-gb';
  const ttsRequestUrl = `https://api.voicerss.org/?key=${encodeURIComponent(settings.voicerss)}&f=22khz_16bit_mono&hl=${encodeURIComponent(selectedLanguage)}&src=${encodeURIComponent(phrase)}&c=MP3`;

  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const filename = `voicerss-${phraseHash}-${safeComponent(selectedLanguage, 'en-gb')}.mp3`;
  const filepath = path.resolve(settings.webroot, 'tts', filename);
  const expectedUri = `/tts/${filename}`;

  try {
    fs.accessSync(filepath, fs.constants.R_OK);
    const duration = await fileDuration(filepath);
    return { duration, uri: expectedUri };
  } catch (_error) {
    // Cache miss; download below.
  }

  const response = await fetch(ttsRequestUrl, {
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Download from voicerss failed with status ${response.status}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    throw new Error('VoiceRSS returned an empty audio response');
  }
  await fs.promises.writeFile(filepath, audio);
  const duration = await fileDuration(filepath);
  return { duration, uri: expectedUri };
}

export = voicerss;
