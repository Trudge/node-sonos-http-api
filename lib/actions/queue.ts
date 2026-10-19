function simplify(items: any[]): any[] {
  return items.map((item) => ({
    title: item.title,
    artist: item.artist,
    album: item.album,
    albumArtUri: item.albumArtUri
  }));
}

function queue(player: any, values: string[]): Promise<any> {
  const detailed = values[values.length - 1] === 'detailed';
  let limit: number | undefined;
  let offset: number | undefined;

  if (/\d+/.test(values[0])) limit = parseInt(values[0], 10);
  if (/\d+/.test(values[1])) offset = parseInt(values[1], 10);

  const promise = player.coordinator.getQueue(limit, offset);
  if (detailed) return promise;
  return promise.then(simplify);
}

export = function (api: any): void {
  api.registerAction('queue', queue);
};
