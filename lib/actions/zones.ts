import type { ActionApi, PlayerLike, ZoneGroupLike } from '../../src/types/actions';

interface SimplifiedPlayer {
  uuid: string;
  state: unknown;
  playMode: unknown;
  roomName: string;
  coordinator: string;
  groupState: unknown;
  airPlayEnabled: unknown;
  micEnabled: unknown;
  wifiEnabled: unknown;
  wirelessMode: unknown;
  roomCalibrationState: unknown;
  hdmiCecAvailable: unknown;
}

interface SimplifiedZone {
  uuid: string;
  coordinator: SimplifiedPlayer;
  members: SimplifiedPlayer[];
}

function simplifyPlayer(player: PlayerLike): SimplifiedPlayer {
  return {
    uuid: player.uuid,
    state: player.state,
    playMode: player.currentPlayMode,
    roomName: player.roomName,
    coordinator: player.coordinator.uuid,
    groupState: player.groupState,
    airPlayEnabled: player.airPlayEnabled,
    micEnabled: player.micEnabled,
    wifiEnabled: player.wifiEnabled,
    wirelessMode: player.wirelessMode,
    roomCalibrationState: player.roomCalibrationState,
    hdmiCecAvailable: player.hdmiCecAvailable
  };
}

function simplifyZones(zones: ZoneGroupLike[]): SimplifiedZone[] {
  return zones.map((zone: ZoneGroupLike) => ({
    uuid: zone.uuid,
    coordinator: simplifyPlayer(zone.coordinator),
    members: zone.members.map(simplifyPlayer)
  }));
}

function zones(player: PlayerLike): Promise<SimplifiedZone[]> {
  return Promise.resolve(simplifyZones(player.system.zones));
}

export = function (api: ActionApi): void {
  api.registerAction('zones', zones);
};
