function services(player: any, values: string[]): Promise<any> {
  if (values[0] === 'all') return Promise.resolve(player.system.availableServices);
  return Promise.resolve();
}

export = function (api: any): void {
  api.registerAction('services', services);
};
