import path = require('path');
import type { ActionApi, PlayerLike } from '../../src/types/actions';

const fileDuration = require('../helpers/file-duration');
const settings = require('../../settings');
const singlePlayerAnnouncement = require('../helpers/single-player-announcement');
const { resolveClipPath } = require('../helpers/safe-path');

let port: number;
const LOCAL_PATH_LOCATION = path.join(settings.webroot, 'clips');

function playClip(player: PlayerLike, values: string[]): Promise<unknown> {
  let announceVolume = settings.announceVolume || 40;
  if (/^\d+$/i.test(values[1])) announceVolume = values[1];

  let clip;
  try {
    clip = resolveClipPath(LOCAL_PATH_LOCATION, values[0]);
  } catch (err) {
    return Promise.reject(err);
  }

  return fileDuration(clip.fullPath).then((duration: number) =>
    singlePlayerAnnouncement(
      player,
      `http://${player.system.localEndpoint}:${port}/clips/${encodeURIComponent(clip.filename)}`,
      announceVolume,
      duration
    )
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('clip', playClip);
};
