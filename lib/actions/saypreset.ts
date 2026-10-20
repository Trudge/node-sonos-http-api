import type { ActionApi, PlayerLike } from '../../src/types/actions';
import tryDownloadTTS = require('../helpers/try-download-tts');
import presetAnnouncement = require('../helpers/preset-announcement');
import presets = require('../presets-loader');

let port: number;

async function sayPreset(player: PlayerLike, values: string[]): Promise<unknown> {
  const presetName = decodeURIComponent(values[0]);
  const preset = presets[presetName] as Parameters<typeof presetAnnouncement>[2] | undefined;
  if (!preset) {
    throw new Error(`No preset named ${presetName} could be found`);
  }

  let text: string;
  try {
    text = decodeURIComponent(values[1]);
  } catch (error) {
    if (error instanceof URIError) {
      error.message = `The encoded phrase ${values[0]} could not be URI decoded. Make sure your url encoded values (%xx) are within valid ranges. xx should be hexadecimal representations`;
    }
    throw error;
  }

  const result = await tryDownloadTTS(text, values[2]);
  if (!result) {
    throw new Error('No TTS provider produced audio for this phrase');
  }

  return presetAnnouncement(
    player.system,
    `http://${player.system.localEndpoint}:${port}${result.uri}`,
    preset,
    result.duration
  );
}

export = function (api: ActionApi): void {
  port = api.getPort();
  api.registerAction('saypreset', sayPreset);
};
