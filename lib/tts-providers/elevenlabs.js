'use strict';
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const fileDuration = require('../helpers/file-duration');
const settings = require('../../settings');
const logger = require('sonos-discovery/lib/helpers/logger');
const { safeComponent } = require('../helpers/safe-path');

const DEFAULT_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.5,
  speakerBoost: true,
  style: 1,
  modelId: "eleven_multilingual_v2"
};

// Provider developed based on structure from aws-polly.js.
// In this tts provider language argument from uri is used to inject custom voiceId
function eleven(phrase, voiceId) {
  if (!settings.elevenlabs) {
    return Promise.resolve();
  }

  // Construct a filesystem neutral filename
  const dynamicParameters = { textInput: phrase };
  const synthesizeParameters = Object.assign({}, DEFAULT_SETTINGS, dynamicParameters, settings.elevenlabs.config);

  if (voiceId) {
    synthesizeParameters.voiceId = voiceId;
  }

  if (!synthesizeParameters.voiceId) {
    console.log('Voice ID not found neither in settings.elevenlabs.config nor in request!')
    return Promise.resolve();
  }

  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const filename = `elevenlabs-${phraseHash}-${safeComponent(synthesizeParameters.voiceId)}.mp3`;
  const filepath = path.resolve(settings.webroot, 'tts', filename);

  synthesizeParameters.fileName = filepath;

  const expectedUri = `/tts/${filename}`;
  try {
    fs.accessSync(filepath, fs.R_OK);
    return fileDuration(filepath)
      .then((duration) => {
        return {
          duration,
          uri: expectedUri
        };
      });
  } catch (err) {
    logger.info(`announce file for phrase "${phrase}" does not seem to exist, downloading`);
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(synthesizeParameters.voiceId)}`;
  const body = JSON.stringify({
    text: phrase,
    model_id: synthesizeParameters.modelId,
    voice_settings: {
      stability: synthesizeParameters.stability,
      similarity_boost: synthesizeParameters.similarityBoost,
      style: synthesizeParameters.style,
      use_speaker_boost: synthesizeParameters.speakerBoost
    }
  });

  return fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': settings.elevenlabs.auth.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg'
    },
    body,
    signal: AbortSignal.timeout(15000)
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`ElevenLabs TTS failed with status ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((audio) => {
      fs.writeFileSync(filepath, Buffer.from(audio));
      return fileDuration(filepath);
    })
    .then((duration) => {
      return {
        duration,
        uri: expectedUri
      };
    });
}

module.exports = eleven;
