'use strict';
const path = require('path');
const requireDir = require('sonos-discovery/lib/helpers/require-dir');
const providers: any[] = [];

requireDir(path.join(__dirname, '../tts-providers'), (provider: any) => {
  providers.push(provider);
});

providers.push(require('../tts-providers/default/google'));

function tryDownloadTTS(phrase:  any, language:  any) {
  let result: any;
  return providers.reduce((promise: any, provider: any) => {
    return promise.then(() => {
      if (result) return result;
      return provider(phrase, language)
        .then((_result: any) => {
          result = _result;
          return result;
        });
      });
  }, Promise.resolve());
}

module.exports = tryDownloadTTS;