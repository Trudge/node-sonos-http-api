import type { ActionApi, PlayerLike, SonosSystemLike } from '../../src/types/actions';
import logger = require('sonos-discovery/lib/helpers/logger');

const lockVolumes: Record<string, number> = {};

function lockvolumes(player: PlayerLike): Promise<unknown> {
  logger.debug('locking volumes');
  const system = player.system as SonosSystemLike;
  system.players.forEach((member: PlayerLike) => {
    lockVolumes[member.uuid] = member.state.volume;
  });
  system.removeListener('volume-change', restrictVolume);
  system.on('volume-change', restrictVolume);
  return Promise.resolve();
}

function unlockvolumes(player: PlayerLike): Promise<unknown> {
  logger.debug('unlocking volumes');
  player.system.removeListener('volume-change', restrictVolume);
  return Promise.resolve();
}

function restrictVolume(this: SonosSystemLike, info: { uuid: string }): Promise<unknown> | undefined {
  const expectedVolume = lockVolumes[info.uuid];
  logger.debug(`should revert volume to ${expectedVolume}`);
  const player = this.getPlayerByUUID(info.uuid);
  if (expectedVolume !== undefined && player.state.volume !== expectedVolume) {
    return player.setVolume(expectedVolume);
  }
  return undefined;
}

export = function (api: ActionApi): void {
  api.registerAction('lockvolumes', lockvolumes);
  api.registerAction('unlockvolumes', unlockvolumes);
};
