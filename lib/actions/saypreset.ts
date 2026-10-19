import type { ActionApi, PlayerLike } from '../../src/types/actions';

const tryDownloadTTS = require('../helpers/try-download-tts');
const presetAnnouncement = require('../helpers/preset-announcement');
const presets = require('../presets-loader');

let port: number;

function sayPreset(player: PlayerLike, values: string[]): Promise<unknown> {
  const presetName = decodeURIComponent(values[0]);
  const preset = presets[presetName];
  if (!preset) return Promise.reject(new Error(`No preset named ${presetName} could be found`));

  let text: string;
  try {
    text = decodeURIComponent(values[1]);
  } catch (err: any) {
    if (err instanceof URIError) {
      err.message = `The encoded phrase ${values[0]} could not be URI decoded. Make sure your url encoded values (%xx) are within valid ranges. xx should be hexadecimal representations`;
    }
    return Promise.reject(err);
  }

  return tryDownloadTTS(text, values[2]).then((result: any) =>
    presetAnnouncement(
      player.system,
      `http://${player.system.localEndpoint}:${port}${result.uri}`,
      preset,
      result.duration
    )
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('saypreset', sayPreset);
};
