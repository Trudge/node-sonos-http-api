import type { ActionApi, PlayerLike } from '../../src/types/actions';

function state(player: PlayerLike): Promise<unknown> {
  return Promise.resolve(player.state);
}

export = function (api: ActionApi): void {
  api.registerAction('state', state);
};
