import type { ActionApi, PlayerLike } from '../../src/types/actions';

function repeat(player: PlayerLike, values: string[]): Promise<unknown> {
  let mode = values[0];
  if (mode === 'on') mode = 'all';
  else if (mode === 'off') mode = 'none';
  else if (mode === 'toggle') {
    switch (player.coordinator.state.playMode.repeat) {
      case 'all': mode = 'one'; break;
      case 'one': mode = 'off'; break;
      default: mode = 'all';
    }
  }
  return player.coordinator.repeat(mode).then(() => ({ status: 'success', repeat: mode }));
}

function shuffle(player: PlayerLike, values: string[]): Promise<unknown> {
  let enable = values[0] === 'on';
  if (values[0] === 'toggle') enable = !player.coordinator.state.playMode.shuffle;
  return player.coordinator.shuffle(enable).then(() => ({ status: 'success', shuffle: enable }));
}

function crossfade(player: PlayerLike, values: string[]): Promise<unknown> {
  let enable = values[0] === 'on';
  if (values[0] === 'toggle') enable = !player.coordinator.state.playMode.crossfade;
  return player.coordinator.crossfade(enable).then(() => ({ status: 'success', crossfade: enable }));
}

export = function (api: ActionApi): void {
  api.registerAction('repeat', repeat);
  api.registerAction('shuffle', shuffle);
  api.registerAction('crossfade', crossfade);
};
