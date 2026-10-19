'use strict';
const path = require('path');
const fileDuration = require('../helpers/file-duration');
const { resolveClipPath } = require('../helpers/safe-path');
const settings = require('../../settings');
const singlePlayerAnnouncement = require('../helpers/single-player-announcement');

let port;

const LOCAL_PATH_LOCATION = path.join(settings.webroot, 'clips');

const backupPresets = {};

function playClip(player, values) {
  let announceVolume = settings.announceVolume || 40;

  if (/^\d+$/i.test(values[1])) {
    // first parameter is volume
    announceVolume = values[1];
  }

  let clip;
  try {
    clip = resolveClipPath(LOCAL_PATH_LOCATION, values[0]);
  } catch (err) {
    return Promise.reject(err);
  }

  return fileDuration(clip.fullPath)
      .then((duration) => {
        return singlePlayerAnnouncement(player, `http://${player.system.localEndpoint}:${port}/clips/${encodeURIComponent(clip.filename)}`, announceVolume, duration);
      });
}

module.exports = function(api) {
  port = api.getPort();
  api.registerAction('clip', playClip);
}
