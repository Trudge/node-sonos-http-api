import request = require('sonos-discovery/lib/helpers/request');
import { XmlEntities } from 'html-entities';

const xmlEntities = new XmlEntities();
const CACHE_TTL_MS = 60000;
const cache = new Map<string, { expires: number; value: DeviceIdentity }>();

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
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    types.push(decode(match[1]) as string);
  }
  return types;
}

export async function getIdentity(player: any): Promise<DeviceIdentity> {
  const cached = cache.get(player.uuid);
  const now = Date.now();
  if (cached && cached.expires > now) return cached.value;

  try {
    const xml = await request({
      uri: `${player.baseUrl}/xml/device_description.xml`,
      timeout: 4000
    });
    const value: DeviceIdentity = {
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
    cache.set(player.uuid, { expires: now + CACHE_TTL_MS, value });
    return value;
  } catch (err) {
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
      error: (err as Error).message
    };
  }
}
