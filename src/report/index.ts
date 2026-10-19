import getUriType = require('sonos-discovery/lib/prototypes/Player/getUriType');
import { getIdentity, DeviceIdentity } from './identity';
import { readAlarms, readHouseholdId, readSleepTimer, SoapResult } from './upnp';

const SCHEMA_VERSION = 1;

interface SourceInfo {
  type: string | null;
  uri: string;
  isRadio: boolean;
  isLineIn: boolean;
  isTv: boolean;
  isQueue: boolean;
  isGroup: boolean;
}

function sourceInfo(player: any): SourceInfo {
  const uri = player.avTransportUri || '';
  let type: string | null = null;
  try {
    type = uri ? getUriType(uri) : null;
  } catch (err) {
    type = null;
  }
  return {
    type,
    uri,
    isRadio: type === 'radio',
    isLineIn: type === 'line_in',
    isTv: uri.startsWith('x-sonos-htastream:'),
    isQueue: uri.startsWith('x-rincon-queue:'),
    isGroup: uri.startsWith('x-rincon:')
  };
}

function playerSummary(player: any): any {
  return {
    uuid: player.uuid,
    roomName: player.roomName,
    coordinator: player.coordinator ? player.coordinator.uuid : player.uuid,
    isCoordinator: player === player.coordinator,
    baseUrl: player.baseUrl,
    hasSub: Boolean(player.hasSub),
    airPlayEnabled: player.airPlayEnabled,
    microphoneEnabled: player.micEnabled,
    wifiEnabled: player.wifiEnabled,
    wirelessMode: player.wirelessMode,
    roomCalibrationState: player.roomCalibrationState,
    hdmiCecAvailable: player.hdmiCecAvailable,
    groupState: player.coordinator ? player.coordinator.groupState : player.groupState,
    state: player.state,
    source: sourceInfo(player)
  };
}

async function playerReport(player: any): Promise<any> {
  const [identity, sleep] = await Promise.all([
    getIdentity(player),
    readSleepTimer(player)
  ]);
  return Object.assign(playerSummary(player), {
    identity,
    sleepTimer: sleep.supported ? sleep.value : null,
    sleepTimerSupported: sleep.supported
  });
}

function findPlayer(system: any, room: string | null): any {
  if (!room) return system.getAnyPlayer();
  return system.players.find((player: any) => player.uuid === room)
    || system.getPlayer(room);
}

function reportSummary(system: any): any {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localEndpoint: system.localEndpoint,
    playerCount: system.players.length,
    zoneCount: system.zones.length,
    services: Object.keys(system.availableServices || {}).length
  };
}

async function reportSystem(system: any): Promise<any> {
  const players = system.players;
  const anyPlayer = system.getAnyPlayer();
  const [identities, household] = await Promise.all([
    Promise.all(players.map((player: any) => getIdentity(player))),
    anyPlayer ? readHouseholdId(anyPlayer) : Promise.resolve({ supported: false } as SoapResult)
  ]);
  const versions: Record<string, number> = {};
  identities.forEach((identity) => {
    const version = identity.softwareVersion || 'unknown';
    versions[version] = (versions[version] || 0) + 1;
  });
  return Object.assign(reportSummary(system), {
    householdId: household.supported ? household.value : null,
    householdSupported: household.supported,
    softwareVersions: versions,
    playersOnline: players.length,
    identityAvailable: identities.filter((identity) => identity.available).length
  });
}

async function reportPlayers(system: any): Promise<any[]> {
  const results = await Promise.allSettled(system.players.map((player: any) => playerReport(player)));
  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    const player = system.players[index];
    return {
      uuid: player.uuid,
      roomName: player.roomName,
      available: false,
      error: result.reason && result.reason.message ? result.reason.message : 'Unable to read player'
    };
  });
}

function reportZones(system: any): any[] {
  return system.zones.map((zone: any) => ({
    uuid: zone.uuid,
    coordinator: zone.coordinator ? playerSummary(zone.coordinator) : null,
    members: zone.members.map(playerSummary)
  }));
}

async function reportPlayer(system: any, room: string): Promise<any> {
  const player = findPlayer(system, room);
  if (!player) {
    const err: any = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  return playerReport(player);
}

function capabilityFlags(identity: DeviceIdentity): Record<string, boolean> {
  const services = identity.services.map((service) => service.toLowerCase());
  return {
    alarmClock: services.some((service) => service.includes(':alarmclock:')),
    audioIn: services.some((service) => service.includes(':audioin:')),
    contentDirectory: services.some((service) => service.includes(':contentdirectory:')),
    htControl: services.some((service) => service.includes(':htcontrol:')),
    renderingControl: services.some((service) => service.includes(':renderingcontrol:')),
    groupRenderingControl: services.some((service) => service.includes(':grouprenderingcontrol:')),
    zoneGroupTopology: services.some((service) => service.includes(':zonegrouptopology:'))
  };
}

async function reportCapabilities(system: any, room: string): Promise<any> {
  const player = findPlayer(system, room);
  if (!player) {
    const err: any = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  const identity = await getIdentity(player);
  return {
    uuid: player.uuid,
    roomName: player.roomName,
    identity,
    featureSupport: capabilityFlags(identity),
    hasSub: Boolean(player.hasSub),
    airPlayEnabled: player.airPlayEnabled,
    microphoneEnabled: player.micEnabled,
    wifiEnabled: player.wifiEnabled,
    wirelessMode: player.wirelessMode,
    roomCalibrationState: player.roomCalibrationState,
    hdmiCecAvailable: player.hdmiCecAvailable,
    outputFixed: player.outputFixed
  };
}

async function reportQueue(system: any, room: string | null, limit: number, offset: number): Promise<any> {
  const player = findPlayer(system, room);
  if (!player) {
    const err: any = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : undefined;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const [items, info] = await Promise.all([
    player.coordinator.getQueue(safeLimit, safeOffset),
    player.coordinator.browse('Q:0', safeOffset, safeLimit || 1).catch(() => null)
  ]);
  return {
    uuid: player.coordinator.uuid,
    trackNo: player.coordinator.state.trackNo,
    limit: safeLimit || null,
    offset: safeOffset,
    count: items.length,
    totalMatches: info ? info.totalMatches : null,
    selectedItemIndex: player.coordinator.state.trackNo,
    items
  };
}

async function reportSources(system: any): Promise<any[]> {
  const identities = await Promise.all(system.players.map((player: any) => getIdentity(player)));
  return system.players.map((player: any, index: number) => {
    const identity = identities[index];
    return {
      uuid: player.uuid,
      roomName: player.roomName,
      source: sourceInfo(player),
      featureSupport: capabilityFlags(identity),
      identityAvailable: identity.available,
      state: player.state
    };
  });
}

async function reportLibrary(system: any, room: string | null, objectId: string | undefined, startIndex: number, limit: number): Promise<any> {
  const player = findPlayer(system, room);
  if (!player) {
    const err: any = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  let decodedObjectId = objectId || 'A:';
  try {
    decodedObjectId = decodeURIComponent(decodedObjectId);
  } catch (err) {
    // Keep the raw value if it is not valid percent-encoding.
  }
  const result = await player.browse(decodedObjectId, startIndex || 0, limit || 0);
  return Object.assign({ objectId: decodedObjectId }, result);
}

function reportDiagnostics(system: any): any {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localEndpoint: system.localEndpoint,
    zones: system.zones.map((zone: any) => ({
      uuid: zone.uuid,
      coordinator: zone.coordinator ? zone.coordinator.uuid : null,
      members: zone.members.map((member: any) => member.uuid)
    })),
    players: system.players.map((player: any) => ({
      uuid: player.uuid,
      roomName: player.roomName,
      baseUrl: player.baseUrl,
      coordinator: player.coordinator ? player.coordinator.uuid : null,
      hasSub: Boolean(player.hasSub),
      outputFixed: player.outputFixed
    })),
    services: Object.keys(system.availableServices || {}),
    availableServices: system.availableServices
  };
}

async function reportExport(system: any): Promise<any> {
  const anyPlayer = system.getAnyPlayer();
  const [systemInfo, players, favorites, playlists, sources, alarms] = await Promise.all([
    reportSystem(system),
    reportPlayers(system),
    system.getFavorites().catch(() => []),
    system.getPlaylists().catch(() => []),
    reportSources(system),
    anyPlayer ? readAlarms(anyPlayer) : Promise.resolve({ supported: false } as SoapResult)
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    system: systemInfo,
    zones: reportZones(system),
    players,
    favorites,
    playlists,
    sources,
    alarms: alarms.supported ? alarms.value : []
  };
}

export async function handleReport(player: any, values: string[]): Promise<any> {
  const system = player.system;
  const sub = (values[0] || 'summary').toLowerCase();
  const room = values[1] ? decodeURIComponent(values[1]) : null;

  switch (sub) {
    case 'summary':
      return reportSummary(system);
    case 'system':
      return reportSystem(system);
    case 'zones':
    case 'groups':
      return reportZones(system);
    case 'players':
      if (room && values[2] && values[2].toLowerCase() === 'state') return reportPlayer(system, room);
      if (room && values[2] && values[2].toLowerCase() === 'capabilities') return reportCapabilities(system, room);
      if (room && values[2] && values[2].toLowerCase() === 'queue') {
        return reportQueue(system, room, parseInt(values[3], 10), parseInt(values[4], 10));
      }
      if (room) return reportPlayer(system, room);
      return reportPlayers(system);
    case 'player':
      return reportPlayer(system, room as string);
    case 'favorites':
      return system.getFavorites();
    case 'playlists':
      return system.getPlaylists();
    case 'services':
      return system.availableServices;
    case 'alarms':
      return readAlarms(player).then((result) => ({
        supported: result.supported,
        alarms: result.supported ? result.value : [],
        error: result.error
      }));
    case 'sources':
      return reportSources(system);
    case 'library':
      return reportLibrary(system, room, values[2], parseInt(values[3], 10), parseInt(values[4], 10));
    case 'diagnostics':
      return reportDiagnostics(system);
    case 'export':
      return reportExport(system);
    default: {
      const err: any = new Error('Unknown report: ' + sub);
      err.statusCode = 404;
      throw err;
    }
  }
}
