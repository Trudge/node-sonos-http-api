import type { ActionApi, PlayerLike } from '../../src/types/actions';
import tryDownloadTTS = require('../helpers/try-download-tts');
import singlePlayerAnnouncement = require('../helpers/single-player-announcement');
import settings = require('../../src/settings');

let port: number;

async function say(player: PlayerLike, values: string[]): Promise<unknown> {
  let text: string;
  try {
    text = decodeURIComponent(values[0]);
  } catch (error) {
    if (error instanceof URIError) {
      error.message = `The encoded phrase ${values[0]} could not be URI decoded. Make sure your url encoded values (%xx) are within valid ranges. xx should be hexadecimal representations`;
    }
    throw error;
  }

  let announceVolume: string | number;
  let language: string | undefined;
  if (/^\d+$/i.test(values[1])) {
    announceVolume = values[1];
  } else {
    language = values[1];
    announceVolume = values[2] || settings.announceVolume || 40;
  }

  const result = await tryDownloadTTS(text, language);
  if (!result) {
    throw new Error('No TTS provider produced audio for this phrase');
  }

  return singlePlayerAnnouncement(
    player,
    `http://${player.system.localEndpoint}:${port}${result.uri}`,
    announceVolume,
    result.duration
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('say', say);
};
