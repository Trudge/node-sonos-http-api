import request = require('sonos-discovery/lib/helpers/request');
import soap = require('sonos-discovery/lib/helpers/soap');
import type { PlayerLike } from '../types/actions';

export interface SoapResult {
  supported: boolean;
  value?: unknown;
  error?: string;
}

type SoapResponse = Record<string, unknown>;

function firstString(result: SoapResponse, keys: string[]): string | null {
  for (const key of keys) {
    const value = result[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

async function invoke(player: PlayerLike, path: string, service: string, action: string, inner: string): Promise<SoapResponse> {
  const body = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${service}">${inner}</u:${action}></s:Body></s:Envelope>`;
  const response = await request({
    uri: `${player.baseUrl}${path}`,
    method: 'POST',
    headers: {
      'CONTENT-TYPE': 'text/xml; charset="utf-8"',
      SOAPACTION: `"${service}#${action}"`,
      'CONTENT-LENGTH': Buffer.byteLength(body)
    },
    body,
    type: 'stream',
    timeout: 5000
  });
  return soap.parse(response) as Promise<SoapResponse>;
}

export async function readHouseholdId(player: PlayerLike): Promise<SoapResult> {
  const service = 'urn:schemas-upnp-org:service:ZoneGroupTopology:1';
  try {
    const result = await invoke(player, '/ZoneGroupTopology/Control', service, 'GetHouseholdID', '');
    return {
      supported: true,
      value: firstString(result, ['currenthouseholdid', 'CurrentHouseholdID'])
    };
  } catch (err) {
    return { supported: false, error: (err as Error).message };
  }
}

export async function readSleepTimer(player: PlayerLike): Promise<SoapResult> {
  const service = 'urn:schemas-upnp-org:service:AVTransport:1';
  try {
    const result = await invoke(
      player,
      '/MediaRenderer/AVTransport/Control',
      service,
      'GetRemainingSleepTimerDuration',
      '<InstanceID>0</InstanceID>'
    );
    return {
      supported: true,
      value: firstString(result, ['remainingsleeptimerduration', 'RemainingSleepTimerDuration'])
    };
  } catch (err) {
    return { supported: false, error: (err as Error).message };
  }
}

export function parseAlarmXml(xml: unknown): Record<string, string>[] {
  if (typeof xml !== 'string') return [];
  const alarms: Record<string, string>[] = [];
  const alarmRe = /<Alarm\s+([^>]+?)\/>(?:<\/Alarm>)?/gi;
  let match = alarmRe.exec(xml);
  while (match !== null) {
    const alarm: Record<string, string> = {};
    const attrRe = /([A-Za-z0-9_]+)="([^"]*)"/g;
    let attr = attrRe.exec(match[1]);
    while (attr !== null) {
      alarm[attr[1]] = attr[2];
      attr = attrRe.exec(match[1]);
    }
    alarms.push(alarm);
    match = alarmRe.exec(xml);
  }
  return alarms;
}

export async function readAlarms(player: PlayerLike): Promise<SoapResult> {
  const service = 'urn:schemas-upnp-org:service:AlarmClock:1';
  try {
    const result = await invoke(player, '/AlarmClock/Control', service, 'ListAlarms', '<ID>0</ID>');
    return {
      supported: true,
      value: parseAlarmXml(result?.currentalarmlist)
    };
  } catch (err) {
    return { supported: false, error: (err as Error).message };
  }
}
