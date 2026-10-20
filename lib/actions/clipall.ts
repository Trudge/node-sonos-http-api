import path = require('node:path');
import type { ActionApi, PlayerLike } from '../../src/types/actions';
import settings = require('../../src/settings');
import allPlayerAnnouncement = require('../helpers/all-player-announcement');
import fileDuration = require('../helpers/file-duration');
import { resolveClipPath } from '../../src/fs/safe-path';

let port: number;
const LOCAL_PATH_LOCATION = path.join(settings.webroot, 'clips');

async function playClipOnAll(player: PlayerLike, values: string[]): Promise<unknown> {
  const announceVolume = /^\d+$/i.test(values[1]) ? values[1] : (settings.announceVolume || 40);
  const clip = resolveClipPath(LOCAL_PATH_LOCATION, values[0]);
  const duration = await fileDuration(clip.fullPath);

  return allPlayerAnnouncement(
    player.system,
    `http://${player.system.localEndpoint}:${port}/clips/${encodeURIComponent(clip.filename)}`,
    announceVolume,
    duration
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('clipall', playClipOnAll);
};
