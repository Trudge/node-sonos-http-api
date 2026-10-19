function simplifyPlayer(player: any): any {
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

function simplifyZones(zones: any[]): any[] {
  return zones.map((zone) => ({
    uuid: zone.uuid,
    coordinator: simplifyPlayer(zone.coordinator),
    members: zone.members.map(simplifyPlayer)
  }));
}

function zones(player: any): Promise<any[]> {
  return Promise.resolve(simplifyZones(player.system.zones));
}

export = function (api: any): void {
  api.registerAction('zones', zones);
};
