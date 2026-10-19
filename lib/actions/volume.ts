import type { ActionApi, PlayerLike } from '../../src/types/actions';

function volume(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.setVolume(values[0]);
}

function groupVolume(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.coordinator.setGroupVolume(values[0]);
}

export = function (api: ActionApi): void {
  api.registerAction('volume', volume);
  api.registerAction('groupvolume', groupVolume);
};
