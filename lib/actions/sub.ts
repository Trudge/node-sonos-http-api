import type { ActionApi, PlayerLike } from '../../src/types/actions';

function sub(player: PlayerLike, values: string[]): Promise<unknown> {
  if (!player.hasSub) {
    return Promise.reject(new Error("This zone doesn't have a SUB connected"));
  }
  switch (values[0]) {
    case 'on': return player.subEnable();
    case 'off': return player.subDisable();
    case 'gain': return player.subGain(values[1]);
    case 'crossover': return player.subCrossover(values[1]);
    case 'polarity': return player.subPolarity(values[1]);
  }
  return Promise.resolve({ message: 'Valid options are on, off, gain, crossover, polarity' });
}

export = function (api: ActionApi): void {
  api.registerAction('sub', sub);
};
