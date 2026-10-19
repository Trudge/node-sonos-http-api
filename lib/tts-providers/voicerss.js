'use strict';
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const fileDuration = require('../helpers/file-duration');
const settings = require('../../settings');
const { safeComponent } = require('../helpers/safe-path');

function voicerss(phrase, language) {
  if (!settings.voicerss) {
    return Promise.resolve();

  }

  if (!language) {
    language = 'en-gb';
  }
  // Use voicerss tts translation service to create a mp3 file
  // Option "c=MP3" added. Otherwise a WAV file is created that won't play on Sonos.
  const ttsRequestUrl = `https://api.voicerss.org/?key=${settings.voicerss}&f=22khz_16bit_mono&hl=${language}&src=${encodeURIComponent(phrase)}&c=MP3`;

  // Construct a filesystem neutral filename
  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const filename = `voicerss-${phraseHash}-${safeComponent(language, 'en-gb')}.mp3`;
  const filepath = path.resolve(settings.webroot, 'tts', filename);

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
    console.log(`announce file for phrase "${phrase}" does not seem to exist, downloading`);
  }

  return new Promise((resolve, reject) => {
    var file = fs.createWriteStream(filepath);
    const req = https.get(ttsRequestUrl, function (response) {
      if (response.statusCode < 300 && response.statusCode >= 200) {
        response.pipe(file);
        file.on('finish', function () {
          file.end();
          resolve(expectedUri);
        });
      } else {
        reject(new Error(`Download from voicerss failed with status ${response.statusCode}, ${response.message}`));

      }
    });
    req.setTimeout(10000, () => req.destroy(new Error('VoiceRSS request timed out')));
    req.on('error', function (err) {
      reject(err);
    });
  })
    .then(() => {
      return fileDuration(filepath);
    })
    .then((duration) => {
      return {
        duration,
        uri: expectedUri
      };
    });
}

module.exports = voicerss;
