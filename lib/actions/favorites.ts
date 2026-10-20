import type { ActionApi, MediaItem, PlayerLike } from '../../src/types/actions';

function favorites(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.system.getFavorites().then((items: MediaItem[]) => {
    if (values[0] === 'detailed') return items;
    return items.map((item: MediaItem) => item.title);
  });
}

export = function (api: ActionApi): void {
  api.registerAction('favorites', favorites);
  api.registerAction('favourites', favorites);
};
