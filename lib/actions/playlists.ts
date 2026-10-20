import type { ActionApi, MediaItem, PlayerLike } from '../../src/types/actions';

function playlists(player: PlayerLike, values: string[]): Promise<unknown> {
  return player.system.getPlaylists().then((items: MediaItem[]) => {
    if (values[0] === 'detailed') return items;
    return items.map((item: MediaItem) => item.title);
  });
}

export = function (api: ActionApi): void {
  api.registerAction('playlists', playlists);
};
