import type { ActionApi, PlayerLike } from '../../src/types/actions';
import presets = require('../presets-loader');

function presetsAction(player: PlayerLike, values: string[]): Promise<unknown> {
  const value = decodeURIComponent(values[0]);
  let preset: unknown;
  if (value.startsWith('{')) {
    preset = JSON.parse(value);
  } else {
    preset = presets[value];
  }

  if (preset) {
    return player.system.applyPreset(preset);
  }
  return Promise.resolve(Object.keys(presets));
}

export = function (api: ActionApi): void {
  api.registerAction('preset', presetsAction);
};
