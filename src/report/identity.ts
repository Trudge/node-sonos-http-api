import request = require('sonos-discovery/lib/helpers/request');
import { XmlEntities } from 'html-entities';
import type { PlayerLike } from '../types/actions';

const xmlEntities = new XmlEntities();
const CACHE_TTL_MS = 60000;
const FAILURE_TTL_MS = 15000;
const cache = new Map<string, { expires: number; value: DeviceIdentity }>();
const inFlight = new Map<string, Promise<DeviceIdentity>>();

export interface DeviceIdentity {
  available: boolean;
  udn: string | null;
  modelName: string | null;
  modelNumber: string | null;
  displayName: string | null;
  roomName: string | null;
  serialNumber: string | null;
  softwareVersion: string | null;
  hardwareVersion: string | null;
  macAddress: string | null;
  zoneType: string | null;
  services: string[];
  error?: string;
}

function decode(value: string | undefined): string | null {
  return value === undefined ? null : xmlEntities.decode(String(value).trim());
}

function firstTag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decode(match[1]) : null;
}

function serviceTypes(xml: string): string[] {
  const types: string[] = [];
  const re = /<serviceType>([^<]+)<\/serviceType>/gi;
  let match = re.exec(xml);
  while (match !== null) {
    types.push(decode(match[1]) as string);
    match = re.exec(xml);
  }
  return types;
}

export function parseIdentityXml(xml: string): DeviceIdentity {
  return {
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
}

function unavailable(error: unknown): DeviceIdentity {
  return {
    available: false,
    udn: null,
    modelName: null,
    modelNumber: null,
    displayName: null,
    roomName: null,
    serialNumber: null,
    softwareVersion: null,
    hardwareVersion: null,
    macAddress: null,
    zoneType: null,
    services: [],
    error: error instanceof Error ? error.message : String(error)
  };
}

export function getIdentity(player: PlayerLike): Promise<DeviceIdentity> {
  const key = player.uuid || player.baseUrl;
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return Promise.resolve(cached.value);
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const identityPromise = request({
    uri: `${player.baseUrl}/xml/device_description.xml`,
    timeout: 4000
  })
    .then((xml: unknown) => {
      const value = parseIdentityXml(String(xml));
      cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
      return value;
    })
    .catch((error: unknown) => {
      const value = unavailable(error);
      cache.set(key, { expires: Date.now() + FAILURE_TTL_MS, value });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, identityPromise);
  return identityPromise;
}
