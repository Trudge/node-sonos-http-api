'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fileDuration = require('../helpers/file-duration');
const settings = require('../../src/settings');
const logger = require('sonos-discovery/lib/helpers/logger');
const { execFile } = require('child_process');

function macSay(phrase, voice) {
  if (!settings.macSay) {
    return Promise.resolve();
  }

  var selcetedRate = settings.macSay.rate;
  if( !selcetedRate ) {
    selcetedRate = "default";
  }
  var selectedVoice = settings.macSay.voice;
  if( voice ) {
    selectedVoice = voice;
  }

  // Construct a filesystem-safe filename. Voice and rate are also used as
  // process arguments, but the filename must not allow path separators.
  const phraseHash = crypto.createHash('sha1').update(phrase).digest('hex');
  const safeRate = /^\d+$/.test(String(selcetedRate)) ? String(selcetedRate) : '';
  const safeVoice = String(selectedVoice || 'default').replace(/[^A-Za-z0-9_.-]/g, '_');
  const filename = `macSay-${phraseHash}-${safeRate || 'default'}-${safeVoice}.m4a`;
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
    //
    // For more information on the "say" command, type "man say" in Terminal
    // or go to
    // https://developer.apple.com/legacy/library/documentation/Darwin/Reference/ManPages/man1/say.1.html
    //
    // The list of available voices can be configured in
    // System Preferences -> Accessibility -> Speech -> System Voice
    //

    // Never pass the phrase through a shell. execFile keeps it as one
    // literal argument, so quotes, semicolons, $() and backticks are spoken
    // as text instead of being interpreted by /bin/sh.
    const args = [];
    if (selectedVoice) {
      args.push('-v', safeVoice);
    }
    if (safeRate) {
      args.push('-r', safeRate);
    }
    args.push('-o', filepath, phrase);

    execFile('say', args, { timeout: 30000 }, function (error) {
      if (error !== null) {
        reject(error);
      } else {
        resolve(expectedUri);
      }
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

module.exports = macSay;
