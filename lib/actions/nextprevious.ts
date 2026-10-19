import type { ActionApi, PlayerLike } from '../../src/types/actions';

function next(player: PlayerLike): Promise<unknown> {
  return player.coordinator.nextTrack();
}

function previous(player: PlayerLike): Promise<unknown> {
  return player.coordinator.previousTrack();
}

export = function (api: ActionApi): void {
  api.registerAction('next', next);
  api.registerAction('previous', previous);
};
