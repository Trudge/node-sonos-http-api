import type { ActionApi, PlayerLike, SonosSystemLike } from '../../src/types/actions';

const logger = require('sonos-discovery/lib/helpers/logger');
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

function restrictVolume(this: SonosSystemLike, info: any): Promise<unknown> | undefined {
  logger.debug(`should revert volume to ${lockVolumes[info.uuid]}`);
  const player = this.getPlayerByUUID(info.uuid);
  if (player.state.volume !== lockVolumes[info.uuid]) {
    return player.setVolume(lockVolumes[info.uuid]);
  }
  return undefined;
}

export = function (api: ActionApi): void {
  api.registerAction('lockvolumes', lockvolumes);
  api.registerAction('unlockvolumes', unlockvolumes);
};
