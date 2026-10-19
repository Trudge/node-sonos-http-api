import type { ActionApi, PlayerLike } from '../../src/types/actions';

function sleep(player: PlayerLike, values: string[]): Promise<unknown> {
  let timestamp: string | number = 0;
  if (/^\d+$/.test(values[0])) {
    timestamp = values[0];
  } else if (values[0].toLowerCase() !== 'off') {
    return Promise.resolve();
  }
  return player.coordinator.sleep(timestamp);
}

export = function (api: ActionApi): void {
  api.registerAction('sleep', sleep);
};
