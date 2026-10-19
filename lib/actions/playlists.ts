function playlists(player: any, values: string[]): Promise<any> {
  return player.system.getPlaylists().then((items: any[]) => {
    if (values[0] === 'detailed') return items;
    return items.map((item: any) => item.title);
  });
}

export = function (api: any): void {
  api.registerAction('playlists', playlists);
};
