import type { ActionApi, MediaItem, PlayerLike } from '../../src/types/actions';

interface QueueItem {
  title?: string;
  artist?: string;
  album?: string;
  albumArtUri?: string;
}

function simplify(items: MediaItem[]): QueueItem[] {
  return items.map((item: MediaItem) => ({
    title: item.title,
    artist: item.artist,
    album: item.album,
    albumArtUri: item.albumArtUri
  }));
}

function queue(player: PlayerLike, values: string[]): Promise<unknown> {
  const detailed = values[values.length - 1] === 'detailed';
  let limit: number | undefined;
  let offset: number | undefined;

  if (/^\d+$/.test(values[0] || '')) limit = parseInt(values[0], 10);
  if (/^\d+$/.test(values[1] || '')) offset = parseInt(values[1], 10);

  const promise = player.coordinator.getQueue(limit, offset);
  if (detailed) return promise;
  return promise.then(simplify);
}

export = function (api: ActionApi): void {
  api.registerAction('queue', queue);
};
