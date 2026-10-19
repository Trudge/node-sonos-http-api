import type { ActionApi, PlayerLike } from '../../src/types/actions';

function nightMode(player: PlayerLike, values: string[]): Promise<unknown> {
  let enable = values[0] === 'on';
  if (values[0] === 'toggle') enable = !player.coordinator.state.equalizer.nightMode;
  return player.nightMode(enable).then(() => ({ status: 'success', nightmode: enable }));
}

function speechEnhancement(player: PlayerLike, values: string[]): Promise<unknown> {
  let enable = values[0] === 'on';
  if (values[0] === 'toggle') enable = !player.coordinator.state.equalizer.speechEnhancement;
  return player.speechEnhancement(enable).then(() => ({ status: 'success', speechenhancement: enable }));
}

function bass(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.setBass(parseInt(values[0], 10));
}

function treble(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.setTreble(parseInt(values[0], 10));
}

export = function (api: ActionApi): void {
  api.registerAction('nightmode', nightMode);
  api.registerAction('speechenhancement', speechEnhancement);
  api.registerAction('bass', bass);
  api.registerAction('treble', treble);
};
