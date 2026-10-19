'use strict';
const request = require('sonos-discovery/lib/helpers/request');
const soap = require('sonos-discovery/lib/helpers/soap');
const getUriType = require('sonos-discovery/lib/prototypes/Player/getUriType');
const { XmlEntities } = require('html-entities');

const xmlEntities = new XmlEntities();
const SCHEMA_VERSION = 1;
const DESCRIPTION_TTL_MS = 60000;
const identityCache = new Map();

function decode(value) {
  return value === undefined || value === null ? null : xmlEntities.decode(String(value));
}

function firstTag(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decode(match[1].trim()) : null;
}

function serviceTypes(xml) {
  const types = [];
  const re = /<serviceType>([^<]+)<\/serviceType>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    types.push(decode(match[1].trim()));
  }
  return types;
}

async function getIdentity(player) {
  const cached = identityCache.get(player.uuid);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.value;

  try {
    const xml = await request({
      uri: `${player.baseUrl}/xml/device_description.xml`,
      timeout: 4000
    });
    const value = {
      available: true,
      udn: firstTag(xml, 'UDN'),
      modelName: firstTag(xml, 'modelName'),
      modelNumber: firstTag(xml, 'modelNumber'),
      displayName: firstTag(xml, 'displayName'),
      roomName: firstTag(xml, 'roomName'),
      serialNumber: firstTag(xml, 'serialNum'),
      softwareVersion: firstTag(xml, 'softwareVersion'),
      hardwareVersion: firstTag(xml, 'hardwareVersion'),
      macAddress: firstTag(xml, 'MACAddress'),
      zoneType: firstTag(xml, 'zoneType'),
      services: serviceTypes(xml)
    };
    identityCache.set(player.uuid, { expires: now + DESCRIPTION_TTL_MS, value });
    return value;
  } catch (err) {
    return { available: false, error: err.message };
  }
}

function sourceInfo(player) {
  const uri = player.avTransportUri || '';
  let type = null;
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

function playerSummary(player) {
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

async function playerReport(player) {
  const [identity] = await Promise.all([getIdentity(player)]);
  return Object.assign(playerSummary(player), { identity });
}

function findPlayer(system, room) {
  if (!room) {
    return system.getAnyPlayer();
  }
  return system.players.find((player) => player.uuid === room)
    || system.getPlayer(room);
}

function reportSummary(system) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localEndpoint: system.localEndpoint,
    playerCount: system.players.length,
    zoneCount: system.zones.length,
    services: Object.keys(system.availableServices || {}).length
  };
}

async function reportPlayers(system) {
  return Promise.all(system.players.map(playerReport));
}

function reportZones(system) {
  return system.zones.map((zone) => ({
    uuid: zone.uuid,
    coordinator: zone.coordinator ? playerSummary(zone.coordinator) : null,
    members: zone.members.map(playerSummary)
  }));
}

async function reportPlayer(system, room) {
  const player = findPlayer(system, room);
  if (!player) {
    const err = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  return playerReport(player);
}

async function reportCapabilities(system, room) {
  const player = findPlayer(system, room);
  if (!player) {
    const err = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  const identity = await getIdentity(player);
  return {
    uuid: player.uuid,
    roomName: player.roomName,
    identity,
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

async function reportQueue(system, room, limit, offset) {
  const player = findPlayer(system, room || (system.getAnyPlayer() || {}).roomName);
  if (!player) {
    const err = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : undefined;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const items = await player.coordinator.getQueue(safeLimit, safeOffset);
  return {
    uuid: player.coordinator.uuid,
    trackNo: player.coordinator.state.trackNo,
    limit: safeLimit || null,
    offset: safeOffset,
    count: items.length,
    items
  };
}

async function reportSources(system) {
  return system.players.map((player) => ({
    uuid: player.uuid,
    roomName: player.roomName,
    source: sourceInfo(player),
    state: player.state
  }));
}

async function reportAlarms(player) {
  if (!player) {
    return { supported: false, error: 'No player available' };
  }
  const service = 'urn:schemas-upnp-org:service:AlarmClock:1';
  const action = `${service}#ListAlarms`;
  const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:ListAlarms xmlns:u="${service}"><ID>0</ID></u:ListAlarms></s:Body></s:Envelope>`;
  const response = await request({
    uri: `${player.baseUrl}/AlarmClock/Control`,
    method: 'POST',
    headers: {
      'CONTENT-TYPE': 'text/xml; charset="utf-8"',
      SOAPACTION: `"${action}"`,
      'CONTENT-LENGTH': Buffer.byteLength(body)
    },
    body,
    type: 'stream',
    timeout: 5000
  });
  try {
    return { supported: true, alarms: await soap.parse(response) };
  } catch (err) {
    return { supported: false, error: err.message };
  }
}

async function reportLibrary(system, room, objectId, startIndex, limit) {
  const player = findPlayer(system, room || (system.getAnyPlayer() || {}).roomName);
  if (!player) {
    const err = new Error(`Unknown player: ${room}`);
    err.statusCode = 404;
    throw err;
  }
  return player.browse(objectId || 'A:', startIndex || 0, limit || 0);
}

function reportDiagnostics(system) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    localEndpoint: system.localEndpoint,
    zones: system.zones.map((zone) => ({
      uuid: zone.uuid,
      coordinator: zone.coordinator ? zone.coordinator.uuid : null,
      members: zone.members.map((m) => m.uuid)
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

async function reportExport(system) {
  const [players, favorites, playlists] = await Promise.all([
    reportPlayers(system),
    system.getFavorites().catch(() => []),
    system.getPlaylists().catch(() => [])
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    system: {
      localEndpoint: system.localEndpoint,
      availableServices: system.availableServices || {}
    },
    zones: reportZones(system),
    players,
    favorites,
    playlists
  };
}

function report(player, values) {
  const system = player.system;
  const sub = (values[0] || 'summary').toLowerCase();
  const room = values[1] ? decodeURIComponent(values[1]) : null;

  switch (sub) {
    case 'summary':
      return Promise.resolve(reportSummary(system));
    case 'system':
      return Promise.resolve(reportSummary(system));
    case 'zones':
      return Promise.resolve(reportZones(system));
    case 'groups':
      return Promise.resolve(reportZones(system));
    case 'players':
      if (room && values[2] && values[2].toLowerCase() === 'state') {
        return reportPlayer(system, room);
      }
      if (room && values[2] && values[2].toLowerCase() === 'capabilities') {
        return reportCapabilities(system, room);
      }
      if (room && values[2] && values[2].toLowerCase() === 'queue') {
        return reportQueue(system, room, parseInt(values[3], 10), parseInt(values[4], 10));
      }
      if (room) {
        return reportPlayer(system, room);
      }
      return reportPlayers(system);
    case 'player':
      return reportPlayer(system, room);
    case 'favorites':
      return system.getFavorites();
    case 'playlists':
      return system.getPlaylists();
    case 'services':
      return Promise.resolve(system.availableServices);
    case 'alarms':
      return reportAlarms(player);
    case 'sources':
      return reportSources(system);
    case 'library':
      return reportLibrary(system, values[1], values[2], parseInt(values[3], 10), parseInt(values[4], 10));
    case 'diagnostics':
      return Promise.resolve(reportDiagnostics(system));
    case 'export':
      return reportExport(system);
    default: {
      const err = new Error('Unknown report: ' + sub);
      err.statusCode = 404;
      return Promise.reject(err);
    }
  }
}

module.exports = function (api) {
  api.registerAction('report', report);
};
