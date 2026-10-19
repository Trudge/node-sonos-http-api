'use strict';
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const fileDuration = require('../../helpers/file-duration');
const settings = require('../../../src/settings');
const logger = require('sonos-discovery/lib/helpers/logger');
const { safeComponent } = require('../../../src/fs/safe-path');

function google(phrase, language) {
  if (!language) {
    language = 'en';
  }

  // Use Google tts translation service to create a mp3 file
  const ttsRequestUrl = 'http://translate.google.com/translate_tts?client=tw-ob&tl=' + language + '&q=' + encodeURIComponent(phrase);

  // Construct a filesystem neutral filename
  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const filename = `google-${phraseHash}-${safeComponent(language, 'en')}.mp3`;
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
    logger.info(`announce file for phrase "${phrase}" does not seem to exist, downloading`);
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const options = {
      "headers": { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.106 Safari/537.36" },
      "host": "translate.google.com",
      "path": "/translate_tts?client=tw-ob&tl=" + language + "&q=" + encodeURIComponent(phrase)
    }
    const req = http.request(options, function (response) {
      if (response.statusCode < 300 && response.statusCode >= 200) {
        response.pipe(file);
        file.on('finish', function () {
          file.end();
          resolve(expectedUri);
        });
      } else {
        reject(new Error(`Download from google TTS failed with status ${response.statusCode}, ${response.message}`));

      }
    });

    req.setTimeout(10000, () => req.destroy(new Error('Google TTS request timed out')));
    req.on('error', function (err) {
      reject(err);
    }).end();
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

module.exports = google;
