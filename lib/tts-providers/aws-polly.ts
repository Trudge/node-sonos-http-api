import crypto = require('node:crypto');
import fs = require('node:fs');
import path = require('node:path');
import {
  PollyClient,
  SynthesizeSpeechCommand,
  type SynthesizeSpeechCommandInput
} from '@aws-sdk/client-polly';
import fileDuration = require('../helpers/file-duration');
import settings = require('../../src/settings');
import logger = require('sonos-discovery/lib/helpers/logger');
import { safeComponent } from '../../src/fs/safe-path';

interface TtsResult {
  duration: number;
  uri: string;
}

const DEFAULT_SETTINGS = {
  OutputFormat: 'mp3',
  VoiceId: 'Joanna',
  TextType: 'text'
} as const;

async function polly(phrase: string, voiceName?: string): Promise<TtsResult | undefined> {
  if (!settings.aws) {
    return undefined;
  }

  const synthesizeParameters: SynthesizeSpeechCommandInput = {
    ...DEFAULT_SETTINGS,
    Text: phrase
  };

  let voiceId = settings.aws.name || DEFAULT_SETTINGS.VoiceId;
  if (voiceName) {
    voiceId = voiceName;
  }
  if (voiceId.endsWith('Neural')) {
    synthesizeParameters.Engine = 'neural';
    voiceId = voiceId.slice(0, -6);
  }
  synthesizeParameters.VoiceId = voiceId as SynthesizeSpeechCommandInput['VoiceId'];

  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const filename = `polly-${phraseHash}-${safeComponent(synthesizeParameters.VoiceId)}.mp3`;
  const filepath = path.resolve(settings.webroot, 'tts', filename);
  const expectedUri = `/tts/${filename}`;

  try {
    fs.accessSync(filepath, fs.constants.R_OK);
    const duration = await fileDuration(filepath);
    return { duration, uri: expectedUri };
  } catch (_error) {
    logger.info(`announce file for phrase "${phrase}" does not seem to exist, downloading`);
  }

  const client = new PollyClient({
    region: settings.aws.region || 'us-east-1',
    credentials: settings.aws.credentials
  });

  try {
    const data = await client.send(new SynthesizeSpeechCommand(synthesizeParameters));
    if (!data.AudioStream) {
      throw new Error('AWS Polly returned no audio stream');
    }
    const audio = await data.AudioStream.transformToByteArray();
    await fs.promises.writeFile(filepath, audio);
    const duration = await fileDuration(filepath);
    return { duration, uri: expectedUri };
  } finally {
    client.destroy();
  }
}

export = polly;
