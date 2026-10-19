import path = require('path');
import type { ActionApi, PlayerLike } from '../../src/types/actions';

const settings = require('../../src/settings');
const presetAnnouncement = require('../helpers/preset-announcement');
const fileDuration = require('../helpers/file-duration');
const presets = require('../presets-loader');
const { resolveClipPath } = require('../../src/fs/safe-path');

let port: number;
const LOCAL_PATH_LOCATION = path.join(settings.webroot, 'clips');

function playClipOnPreset(player: PlayerLike, values: string[]): Promise<unknown> {
  const presetName = decodeURIComponent(values[0]);
  const preset = presets[presetName];
  if (!preset) return Promise.reject(new Error(`No preset named ${presetName} could be found`));

  let clip;
  try {
    clip = resolveClipPath(LOCAL_PATH_LOCATION, values[1]);
  } catch (err) {
    return Promise.reject(err);
  }

  return fileDuration(clip.fullPath).then((duration: number) =>
    presetAnnouncement(
      player.system,
      `http://${player.system.localEndpoint}:${port}/clips/${encodeURIComponent(clip.filename)}`,
      preset,
      duration
    )
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('clippreset', playClipOnPreset);
};
