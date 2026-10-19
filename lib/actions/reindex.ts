import type { ActionApi, PlayerLike } from '../../src/types/actions';

function reindex(player: PlayerLike): Promise<unknown> {
  return player.system.refreshShareIndex();
}

export = function (api: ActionApi): void {
  api.registerAction('reindex', reindex);
};
