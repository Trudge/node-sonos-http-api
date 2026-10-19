'use strict';
const path = require('path');
const settings = require('../../settings');
const presetAnnouncement = require('../helpers/preset-announcement');
const fileDuration = require('../helpers/file-duration');
const { resolveClipPath } = require('../helpers/safe-path');
const presets = require('../presets-loader');

let port;
const LOCAL_PATH_LOCATION = path.join(settings.webroot, 'clips');

function playClipOnPreset(player, values) {
  const presetName = decodeURIComponent(values[0]);
  const preset = presets[presetName];

  if (!preset) {
    return Promise.reject(new Error(`No preset named ${presetName} could be found`));
  }

  let clip;
  try {
    clip = resolveClipPath(LOCAL_PATH_LOCATION, values[1]);
  } catch (err) {
    return Promise.reject(err);
  }

  return fileDuration(clip.fullPath)
    .then((duration) => {
      return presetAnnouncement(player.system, `http://${player.system.localEndpoint}:${port}/clips/${encodeURIComponent(clip.filename)}`, preset, duration);
    });
}

module.exports = function (api) {
  port = api.getPort();
  api.registerAction('clippreset', playClipOnPreset);
}
