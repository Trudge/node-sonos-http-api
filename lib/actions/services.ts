import type { ActionApi, PlayerLike } from '../../src/types/actions';

function services(player: PlayerLike, values: string[]): Promise<unknown> {
  if (values[0] === 'all') return Promise.resolve(player.system.availableServices);
  return Promise.resolve(undefined);
}

export = function (api: ActionApi): void {
  api.registerAction('services', services);
};
