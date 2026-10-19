import type { ActionApi, PlayerLike, SonosSystemLike } from '../../src/types/actions';

const logger = require('sonos-discovery/lib/helpers/logger');
let pausedPlayers: string[] = [];

function pauseAll(player: PlayerLike, values: string[]): Promise<unknown> {
  logger.debug('pausing all players');
  if (values[0] && Number(values[0]) > 0) {
    logger.debug('in', values[0], 'minutes');
    setTimeout(() => doPauseAll(player.system), Number(values[0]) * 1000 * 60);
    return Promise.resolve();
  }
  return doPauseAll(player.system);
}

function resumeAll(player: PlayerLike, values: string[]): Promise<unknown> {
  logger.debug('resuming all players');
  if (values[0] && Number(values[0]) > 0) {
    logger.debug('in', values[0], 'minutes');
    setTimeout(() => doResumeAll(player.system), Number(values[0]) * 1000 * 60);
    return Promise.resolve();
  }
  return doResumeAll(player.system);
}

function doPauseAll(system: SonosSystemLike): Promise<unknown> {
  pausedPlayers = [];
  const promises = system.zones
    .filter((zone: any) => zone.coordinator.state.playbackState === 'PLAYING')
    .map((zone: any) => {
      pausedPlayers.push(zone.uuid);
      return system.getPlayerByUUID(zone.uuid).pause();
    });
  return Promise.all(promises);
}

function doResumeAll(system: SonosSystemLike): Promise<unknown> {
  const promises = pausedPlayers.map((uuid: any) => system.getPlayerByUUID(uuid).play());
  pausedPlayers = [];
  return Promise.all(promises);
}

export = function (api: ActionApi): void {
  api.registerAction('pauseall', pauseAll);
  api.registerAction('resumeall', resumeAll);
};
