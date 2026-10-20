import logger = require('sonos-discovery/lib/helpers/logger');
import isRadioOrLineIn = require('./is-radio-or-line-in');
import type { PlayerLike, PlayerState, ZoneGroupLike } from '../../src/types/actions';

interface PresetPlayer {
  roomName: string;
  volume: number | string;
}

interface PlayMode {
  repeat?: string | boolean;
  shuffle?: boolean;
  crossfade?: boolean;
}

interface BackupPreset {
  players: PresetPlayer[];
  state?: string;
  uri?: string;
  metadata?: unknown;
  playMode?: PlayMode;
  trackNo?: number;
  elapsedTime?: number;
  group?: string;
}

const backupPresets: Record<string, BackupPreset[]> = {};

function singlePlayerAnnouncement(
  player: PlayerLike,
  uri: string,
  volume: number | string,
  duration: number
): Promise<void> {
  const state = player.state;
  const system = player.system;
  let _groupToRejoin: string | undefined;

  const backupPreset: BackupPreset = {
    players: [
      { roomName: player.roomName, volume: state.volume }
    ]
  };

  if (player.coordinator.uuid === player.uuid) {
    const group = system.zones.find((zone: ZoneGroupLike) => zone.coordinator.uuid === player.coordinator.uuid);
    if (group && group.members.length > 1) {
      logger.debug('Think its coordinator, will find uri later');
      _groupToRejoin = group.id;
      backupPreset.group = group.id;
    } else {
      backupPreset.state = state.playbackState;
      backupPreset.uri = player.avTransportUri;
      backupPreset.metadata = player.avTransportUriMetadata;
      backupPreset.playMode = {
        repeat: state.playMode.repeat
      };

      if (!isRadioOrLineIn(String(backupPreset.uri || ''))) {
        backupPreset.trackNo = state.trackNo;
        backupPreset.elapsedTime = state.elapsedTime;
      }
    }
  } else {
    backupPreset.uri = `x-rincon:${player.coordinator.uuid}`;
  }

  logger.debug('backup state was', backupPreset);

  const ttsPreset = {
    players: [
      { roomName: player.roomName, volume }
    ],
    playMode: {
      repeat: false
    },
    uri
  };

  let abortTimer: NodeJS.Timeout | undefined;

  if (!backupPresets[player.roomName]) {
    backupPresets[player.roomName] = [];
  }

  backupPresets[player.roomName].unshift(backupPreset);
  logger.debug('backup presets array', backupPresets[player.roomName]);

  const prepareBackupPreset = async (): Promise<void> => {
    if (backupPresets[player.roomName].length > 1) {
      backupPresets[player.roomName].shift();
      logger.debug('more than 1 backup presets during prepare', backupPresets[player.roomName]);
      return;
    }

    if (backupPresets[player.roomName].length < 1) {
      return;
    }

    const relevantBackupPreset = backupPresets[player.roomName][0];
    logger.debug('exactly 1 preset left', relevantBackupPreset);

    if (relevantBackupPreset.group) {
      const zone = system.zones.find((candidate: ZoneGroupLike) => candidate.id === relevantBackupPreset.group);
      if (zone) {
        relevantBackupPreset.uri = `x-rincon:${zone.uuid}`;
      }
    }

    logger.debug('applying preset', relevantBackupPreset);
    await system.applyPreset(relevantBackupPreset);
    backupPresets[player.roomName].shift();
    logger.debug('after backup preset applied', backupPresets[player.roomName]);
  };

  let timer = 0;
  const restoreTimeout = duration + 2000;
  return system.applyPreset(ttsPreset)
    .then(() => new Promise<void>((resolve) => {
      const transportChange = (stateChange: PlayerState) => {
        logger.debug(`Player changed to state ${stateChange.playbackState}`);
        if (stateChange.playbackState === 'STOPPED') {
          resolve();
          return;
        }
        player.once('transport-state', transportChange);
      };

      setTimeout(() => {
        player.once('transport-state', transportChange);
      }, duration / 2);

      logger.debug(`Setting restore timer for ${restoreTimeout} ms`);
      timer = Date.now();
      abortTimer = setTimeout(resolve, restoreTimeout);
    }))
    .then(() => {
      const elapsed = Date.now() - timer;
      logger.debug(`${elapsed} elapsed with ${restoreTimeout - elapsed} to spare`);
      if (abortTimer) clearTimeout(abortTimer);
    })
    .then(prepareBackupPreset)
    .catch(async (err: unknown) => {
      logger.error(err);
      await prepareBackupPreset();
      throw err;
    });
}

export = singlePlayerAnnouncement;
