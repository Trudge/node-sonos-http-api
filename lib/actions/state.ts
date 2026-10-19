function state(player: any): Promise<any> {
  return Promise.resolve(player.state);
}

export = function (api: any): void {
  api.registerAction('state', state);
};
