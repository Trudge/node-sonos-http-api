import type { ActionApi, PlayerLike } from '../../src/types/actions';

function favorite(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.coordinator.replaceWithFavorite(decodeURIComponent(values[0]))
    .then(() => player.coordinator.play());
}

export = function (api: ActionApi): void {
  api.registerAction('favorite', favorite);
  api.registerAction('favourite', favorite);
};
