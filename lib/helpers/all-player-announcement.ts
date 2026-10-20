import logger = require('sonos-discovery/lib/helpers/logger');
import isRadioOrLineIn = require('./is-radio-or-line-in');
import type { PlayerLike, PlayerState, SonosSystemLike, ZoneGroupLike } from '../../src/types/actions';

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
}

function saveAll(system: SonosSystemLike): BackupPreset[] {
  const backupPresets = system.zones.map((zone: ZoneGroupLike) => {
    const coordinator = zone.coordinator;
    const state = coordinator.state;
    const preset: BackupPreset = {
      players: [
        { roomName: coordinator.roomName, volume: state.volume }
      ],
      state: state.playbackState,
      uri: coordinator.avTransportUri,
      metadata: coordinator.avTransportUriMetadata,
      playMode: {
        repeat: state.playMode.repeat
      }
    };

    if (!isRadioOrLineIn(String(preset.uri || ''))) {
      preset.trackNo = state.trackNo;
      preset.elapsedTime = state.elapsedTime;
    }

    zone.members.forEach((player: PlayerLike) => {
      if (coordinator.uuid !== player.uuid) {
        preset.players.push({ roomName: player.roomName, volume: player.state.volume });
      }
    });

    return preset;
  });

  logger.trace('backup presets', backupPresets);
  return backupPresets.sort((a, b) => a.players.length - b.players.length);
}

function announceAll(
  system: SonosSystemLike,
  uri: string,
  volume: number | string,
  duration: number
): Promise<void> {
  let abortTimer: NodeJS.Timeout | undefined;
  const backupPresets = saveAll(system);
  const allPlayers: PresetPlayer[] = [];
  let biggestZone: ZoneGroupLike | undefined;

  system.zones.forEach((zone: ZoneGroupLike) => {
    if (!biggestZone || zone.members.length > biggestZone.members.length) {
      biggestZone = zone;
    }
  });

  if (!biggestZone) {
    throw new Error('No zones available for announcement');
  }

  const coordinator = biggestZone.coordinator;
  allPlayers.push({ roomName: coordinator.roomName, volume });

  system.players.forEach((player: PlayerLike) => {
    if (player.uuid === coordinator.uuid) return;
    allPlayers.push({ roomName: player.roomName, volume });
  });

  const preset = {
    uri,
    players: allPlayers,
    playMode: {
      repeat: false
    },
    pauseOthers: true,
    state: 'STOPPED'
  };

  const oneGroupPromise = new Promise<void>((resolve) => {
    const onTopologyChanged = (topology: ZoneGroupLike[]) => {
      if (topology.length === 1) {
        resolve();
        return;
      }
      system.once('topology-change', onTopologyChanged);
    };

    system.once('topology-change', onTopologyChanged);
  });

  const restoreTimeout = duration + 2000;
  return system.applyPreset(preset)
    .then(() => {
      if (system.zones.length === 1) return undefined;
      return oneGroupPromise;
    })
    .then(() => {
      coordinator.play();
      return new Promise<void>((resolve) => {
        const transportChange = (state: PlayerState) => {
          logger.debug(`Player changed to state ${state.playbackState}`);
          if (state.playbackState === 'STOPPED') {
            resolve();
            return;
          }
          coordinator.once('transport-state', transportChange);
        };

        setTimeout(() => {
          coordinator.once('transport-state', transportChange);
        }, duration / 2);

        logger.debug(`Setting restore timer for ${restoreTimeout} ms`);
        abortTimer = setTimeout(resolve, restoreTimeout);
      });
    })
    .then(() => {
      if (abortTimer) clearTimeout(abortTimer);
    })
    .then(async () => {
      await backupPresets.reduce(
        (promise: Promise<unknown>, backup: BackupPreset) => {
          logger.trace('Restoring preset', backup);
          return promise.then(() => system.applyPreset(backup));
        },
        Promise.resolve()
      );
    })
    .catch((err: unknown) => {
      logger.error((err as Error).stack);
      throw err;
    });
}

export = announceAll;
