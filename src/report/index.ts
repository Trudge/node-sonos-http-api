import getUriType = require('sonos-discovery/lib/prototypes/Player/getUriType');
import { getIdentity, type DeviceIdentity } from './identity';
import { readAlarms, readHouseholdId, readSleepTimer, type SoapResult } from './upnp';
import type {
  MediaItem,
  PlayerLike,
  PlayerState,
  SonosSystemLike,
  ZoneGroupLike
} from '../types/actions';

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

interface PlayerSummary {
  uuid: string;
  roomName: string;
  coordinator: string;
  isCoordinator: boolean;
  baseUrl: string;
  hasSub: boolean;
  airPlayEnabled: unknown;
  microphoneEnabled: boolean | undefined;
  wifiEnabled: unknown;
  wirelessMode: unknown;
  roomCalibrationState: unknown;
  hdmiCecAvailable: unknown;
  groupState: unknown;
  state: PlayerState;
  source: SourceInfo;
}

interface PlayerReport extends PlayerSummary {
  identity: DeviceIdentity;
  sleepTimer: unknown;
  sleepTimerSupported: boolean;
}

interface FailedPlayerReport {
  uuid: string | null;
  roomName: string | null;
  available: false;
  error: string;
}

type PlayerReportResult = PlayerReport | FailedPlayerReport;

interface ReportSummary {
  schemaVersion: number;
  generatedAt: string;
  localEndpoint: string;
  playerCount: number;
  zoneCount: number;
  services: number;
}

interface SystemReport extends ReportSummary {
  householdId: unknown;
  householdSupported: boolean;
  softwareVersions: Record<string, number>;
  playersOnline: number;
  identityAvailable: number;
}

interface ZoneReport {
  uuid: string;
  coordinator: PlayerSummary | null;
  members: PlayerSummary[];
}

type HttpError = Error & { statusCode: number };

function notFound(message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = 404;
  return error;
}

function sourceInfo(player: PlayerLike): SourceInfo {
  const uri = player.avTransportUri || '';
  let type: string | null = null;
  try {
    type = uri ? getUriType(uri) : null;
  } catch (_err) {
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

function playerSummary(player: PlayerLike): PlayerSummary {
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

async function playerReport(player: PlayerLike): Promise<PlayerReport> {
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

function findPlayer(system: SonosSystemLike, room: string | null): PlayerLike | undefined {
  if (!room) return system.getAnyPlayer();
  return system.players.find((player) => player.uuid === room)
    || system.getPlayer(room);
}

function reportSummary(system: SonosSystemLike): ReportSummary {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localEndpoint: system.localEndpoint,
    playerCount: system.players.length,
    zoneCount: system.zones.length,
    services: Object.keys(system.availableServices || {}).length
  };
}

async function reportSystem(system: SonosSystemLike): Promise<SystemReport> {
  const players = system.players;
  const anyPlayer = system.getAnyPlayer();
  const [identities, household] = await Promise.all([
    Promise.all(players.map((player) => getIdentity(player))),
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

async function reportPlayers(system: SonosSystemLike): Promise<PlayerReportResult[]> {
  const results = await Promise.allSettled(system.players.map((player) => playerReport(player)));
  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    const player = system.players[index];
    let uuid: string | null = null;
    let roomName: string | null = null;
    try {
      uuid = player.uuid;
      roomName = player.roomName;
    } catch (_err) {
      // The player object itself is broken; still return a partial entry.
    }
    return {
      uuid,
      roomName,
      available: false,
      error: result.reason instanceof Error ? result.reason.message : 'Unable to read player'
    };
  });
}

function reportZones(system: SonosSystemLike): ZoneReport[] {
  return system.zones.map((zone: ZoneGroupLike) => ({
    uuid: zone.uuid,
    coordinator: zone.coordinator ? playerSummary(zone.coordinator) : null,
    members: zone.members.map(playerSummary)
  }));
}

async function reportPlayer(system: SonosSystemLike, room: string): Promise<PlayerReport> {
  const player = findPlayer(system, room);
  if (!player) {
    throw notFound(`Unknown player: ${room}`);
  }
  return playerReport(player);
}

export function capabilityFlags(identity: DeviceIdentity): Record<string, boolean> {
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

async function reportCapabilities(system: SonosSystemLike, room: string): Promise<Record<string, unknown>> {
  const player = findPlayer(system, room);
  if (!player) {
    throw notFound(`Unknown player: ${room}`);
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

async function reportQueue(
  system: SonosSystemLike,
  room: string | null,
  limit: number,
  offset: number
): Promise<Record<string, unknown>> {
  const player = findPlayer(system, room);
  if (!player) {
    throw notFound(`Unknown player: ${room}`);
  }
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : undefined;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const [items, info] = await Promise.all([
    player.coordinator.getQueue(safeLimit, safeOffset),
    player.coordinator.browse('Q:0', safeOffset, safeLimit || 1).catch(() => null)
  ]);
  const queueInfo = info as { totalMatches?: number } | null;
  return {
    uuid: player.coordinator.uuid,
    trackNo: player.coordinator.state.trackNo,
    limit: safeLimit || null,
    offset: safeOffset,
    count: items.length,
    totalMatches: queueInfo ? queueInfo.totalMatches : null,
    selectedItemIndex: player.coordinator.state.trackNo,
    items
  };
}

async function reportSources(system: SonosSystemLike): Promise<Record<string, unknown>[]> {
  const identities = await Promise.all(system.players.map((player) => getIdentity(player)));
  return system.players.map((player, index) => {
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

async function reportLibrary(
  system: SonosSystemLike,
  room: string | null,
  objectId: string | undefined,
  startIndex: number,
  limit: number
): Promise<Record<string, unknown>> {
  const player = findPlayer(system, room);
  if (!player) {
    throw notFound(`Unknown player: ${room}`);
  }
  let decodedObjectId = objectId || 'A:';
  try {
    decodedObjectId = decodeURIComponent(decodedObjectId);
  } catch (_err) {
    // Keep the raw value if it is not valid percent-encoding.
  }
  const result = await player.browse(decodedObjectId, startIndex || 0, limit || 0) as Record<string, unknown>;
  return { objectId: decodedObjectId, ...result };
}

function reportDiagnostics(system: SonosSystemLike): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localEndpoint: system.localEndpoint,
    zones: system.zones.map((zone: ZoneGroupLike) => ({
      uuid: zone.uuid,
      coordinator: zone.coordinator ? zone.coordinator.uuid : null,
      members: zone.members.map((member) => member.uuid)
    })),
    players: system.players.map((player) => ({
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

function redactListItem(item: MediaItem): MediaItem {
  const redacted = { ...item };
  delete redacted.metadata;
  return redacted;
}

function redactIdentityForExport(identity: DeviceIdentity): DeviceIdentity {
  return {
    ...identity,
    serialNumber: null,
    macAddress: null
  };
}

function redactPlayerForExport(player: PlayerReportResult): PlayerReportResult {
  if (!('identity' in player) || !player.identity) {
    return player;
  }
  return {
    ...player,
    identity: redactIdentityForExport(player.identity)
  };
}

async function reportExport(system: SonosSystemLike): Promise<Record<string, unknown>> {
  const anyPlayer = system.getAnyPlayer();
  const [systemInfo, players, favorites, playlists, sources, alarms] = await Promise.all([
    reportSystem(system),
    reportPlayers(system),
    system.getFavorites().catch(() => [] as MediaItem[]),
    system.getPlaylists().catch(() => [] as MediaItem[]),
    reportSources(system),
    anyPlayer ? readAlarms(anyPlayer) : Promise.resolve({ supported: false } as SoapResult)
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    redactions: [
      'players[].identity.serialNumber',
      'players[].identity.macAddress',
      'favorites[].metadata',
      'playlists[].metadata'
    ],
    system: systemInfo,
    zones: reportZones(system),
    players: players.map(redactPlayerForExport),
    favorites: favorites.map(redactListItem),
    playlists: playlists.map(redactListItem),
    sources,
    alarms: alarms.supported ? alarms.value : []
  };
}

export async function handleReport(player: PlayerLike, values: string[]): Promise<unknown> {
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
    default:
      throw notFound(`Unknown report: ${sub}`);
  }
}
