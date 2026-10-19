import type { ActionApi, PlayerLike } from '../../src/types/actions';

function clearqueue(player: PlayerLike): Promise<unknown> {
  return player.coordinator.clearQueue();
}

export = function (api: ActionApi): void {
  api.registerAction('clearqueue', clearqueue);
};
