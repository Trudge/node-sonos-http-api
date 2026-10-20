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

interface NamedPreset {
  players: PresetPlayer[];
  playMode?: PlayMode;
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

function announcePreset(
  system: SonosSystemLike,
  uri: string,
  preset: NamedPreset,
  duration: number
): Promise<void> {
  let abortTimer: NodeJS.Timeout | undefined;
  const backupPresets = saveAll(system);
  const simplifiedPreset = {
    uri,
    players: preset.players,
    playMode: preset.playMode,
    pauseOthers: true,
    state: 'STOPPED'
  };

  const hasReachedCorrectTopology = (zones: ZoneGroupLike[]): boolean => zones.some((group: ZoneGroupLike) =>
    group.members.length === preset.players.length
    && group.coordinator.roomName === preset.players[0].roomName);

  const oneGroupPromise = new Promise<void>((resolve) => {
    const onTopologyChanged = (topology: ZoneGroupLike[]) => {
      if (hasReachedCorrectTopology(topology)) {
        resolve();
        return;
      }
      system.once('topology-change', onTopologyChanged);
    };

    system.once('topology-change', onTopologyChanged);
  });

  const restoreTimeout = duration + 2000;
  const coordinator = system.getPlayer(preset.players[0].roomName);
  if (!coordinator) {
    throw new Error(`No player named ${preset.players[0].roomName} could be found`);
  }
  return coordinator.pause()
    .then(() => system.applyPreset(simplifiedPreset))
    .catch(() => system.applyPreset(simplifiedPreset))
    .then(() => {
      if (hasReachedCorrectTopology(system.zones)) return undefined;
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

export = announcePreset;
