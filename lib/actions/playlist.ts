import type { ActionApi, PlayerLike } from '../../src/types/actions';

function playlist(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.coordinator.replaceWithPlaylist(decodeURIComponent(values[0]))
    .then(() => player.coordinator.play());
}

export = function (api: ActionApi): void {
  api.registerAction('playlist', playlist);
};
