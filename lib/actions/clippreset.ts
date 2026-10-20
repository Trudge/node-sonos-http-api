import path = require('node:path');
import type { ActionApi, PlayerLike } from '../../src/types/actions';
import settings = require('../../src/settings');
import presetAnnouncement = require('../helpers/preset-announcement');
import fileDuration = require('../helpers/file-duration');
import presets = require('../presets-loader');
import { resolveClipPath } from '../../src/fs/safe-path';

let port: number;
const LOCAL_PATH_LOCATION = path.join(settings.webroot, 'clips');

async function playClipOnPreset(player: PlayerLike, values: string[]): Promise<unknown> {
  const presetName = decodeURIComponent(values[0]);
  const preset = presets[presetName] as Parameters<typeof presetAnnouncement>[2] | undefined;
  if (!preset) {
    throw new Error(`No preset named ${presetName} could be found`);
  }

  const clip = resolveClipPath(LOCAL_PATH_LOCATION, values[1]);
  const duration = await fileDuration(clip.fullPath);

  return presetAnnouncement(
    player.system,
    `http://${player.system.localEndpoint}:${port}/clips/${encodeURIComponent(clip.filename)}`,
    preset,
    duration
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('clippreset', playClipOnPreset);
};
