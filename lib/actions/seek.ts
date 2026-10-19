import type { ActionApi, PlayerLike } from '../../src/types/actions';

function timeSeek(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.coordinator.timeSeek(values[0]);
}

function trackSeek(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.coordinator.trackSeek(values[0] as any * 1);
}

export = function (api: ActionApi): void {
  api.registerAction('seek', timeSeek);
  api.registerAction('timeseek', timeSeek);
  api.registerAction('trackseek', trackSeek);
};
