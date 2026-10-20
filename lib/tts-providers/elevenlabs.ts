import crypto = require('node:crypto');
import fs = require('node:fs');
import path = require('node:path');
import fileDuration = require('../helpers/file-duration');
import settings = require('../../src/settings');
import logger = require('sonos-discovery/lib/helpers/logger');
import { safeComponent } from '../../src/fs/safe-path';

interface TtsResult {
  duration: number;
  uri: string;
}

const DEFAULT_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.5,
  speakerBoost: true,
  style: 1,
  modelId: 'eleven_multilingual_v2'
};

async function eleven(phrase: string, voiceId?: string): Promise<TtsResult | undefined> {
  if (!settings.elevenlabs) {
    return undefined;
  }

  const synthesizeParameters = Object.assign(
    {},
    DEFAULT_SETTINGS,
    settings.elevenlabs.config,
    { textInput: phrase }
  );

  if (voiceId) {
    synthesizeParameters.voiceId = voiceId;
  }

  if (!synthesizeParameters.voiceId) {
    throw new Error('Voice ID not found neither in settings.elevenlabs.config nor in request');
  }

  const apiKey = settings.elevenlabs.auth?.apiKey;
  if (!apiKey) {
    throw new Error('Missing settings.elevenlabs.auth.apiKey');
  }

  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const filename = `elevenlabs-${phraseHash}-${safeComponent(synthesizeParameters.voiceId)}.mp3`;
  const filepath = path.resolve(settings.webroot, 'tts', filename);
  const expectedUri = `/tts/${filename}`;

  try {
    fs.accessSync(filepath, fs.constants.R_OK);
    const duration = await fileDuration(filepath);
    return { duration, uri: expectedUri };
  } catch (_error) {
    logger.info(`announce file for phrase "${phrase}" does not seem to exist, downloading`);
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(synthesizeParameters.voiceId)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text: phrase,
      model_id: synthesizeParameters.modelId,
      voice_settings: {
        stability: synthesizeParameters.stability,
        similarity_boost: synthesizeParameters.similarityBoost,
        style: synthesizeParameters.style,
        use_speaker_boost: synthesizeParameters.speakerBoost
      }
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed with status ${response.status}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    throw new Error('ElevenLabs returned an empty audio response');
  }
  await fs.promises.writeFile(filepath, audio);
  const duration = await fileDuration(filepath);
  return { duration, uri: expectedUri };
}

export = eleven;
