import type { ActionApi, PlayerLike } from '../../src/types/actions';

const tryDownloadTTS = require('../helpers/try-download-tts');
const allPlayerAnnouncement = require('../helpers/all-player-announcement');
const settings = require('../../settings');

let port: number;

function sayAll(player: PlayerLike, values: string[]): Promise<unknown> {
  let text: string;
  try {
    text = decodeURIComponent(values[0]);
  } catch (err: any) {
    if (err instanceof URIError) {
      err.message = `The encoded phrase ${values[0]} could not be URI decoded. Make sure your url encoded values (%xx) are within valid ranges. xx should be hexadecimal representations`;
    }
    return Promise.reject(err);
  }

  let announceVolume: string | number;
  let language: string | undefined;
  if (/^\d+$/i.test(values[1])) {
    announceVolume = values[1];
  } else {
    language = values[1];
    announceVolume = values[2] || settings.announceVolume || 40;
  }

  return tryDownloadTTS(text, language).then((result: any) =>
    allPlayerAnnouncement(
      player.system,
      `http://${player.system.localEndpoint}:${port}${result.uri}`,
      announceVolume,
      result.duration
    )
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('sayall', sayAll);
};
