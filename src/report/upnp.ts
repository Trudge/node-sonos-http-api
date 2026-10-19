import request = require('sonos-discovery/lib/helpers/request');
import soap = require('sonos-discovery/lib/helpers/soap');

export interface SoapResult {
  supported: boolean;
  value?: any;
  error?: string;
}

async function invoke(player: any, path: string, service: string, action: string, inner: string): Promise<any> {
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
  return soap.parse(response);
}

export async function readHouseholdId(player: any): Promise<SoapResult> {
  const service = 'urn:schemas-upnp-org:service:ZoneGroupTopology:1';
  try {
    const result = await invoke(player, '/ZoneGroupTopology/Control', service, 'GetHouseholdID', '');
    return {
      supported: true,
      value: result && (result.currenthouseholdid || result.CurrentHouseholdID || null)
    };
  } catch (err) {
    return { supported: false, error: (err as Error).message };
  }
}

export async function readSleepTimer(player: any): Promise<SoapResult> {
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
      value: result && (result.remainingsleeptimerduration || result.RemainingSleepTimerDuration || null)
    };
  } catch (err) {
    return { supported: false, error: (err as Error).message };
  }
}

export function parseAlarmXml(xml: unknown): Record<string, string>[] {
  if (typeof xml !== 'string') return [];
  const alarms: Record<string, string>[] = [];
  const alarmRe = /<Alarm\s+([^>]+?)\/>(?:<\/Alarm>)?/gi;
  let match: RegExpExecArray | null;
  while ((match = alarmRe.exec(xml)) !== null) {
    const alarm: Record<string, string> = {};
    const attrRe = /([A-Za-z0-9_]+)="([^"]*)"/g;
    let attr: RegExpExecArray | null;
    while ((attr = attrRe.exec(match[1])) !== null) {
      alarm[attr[1]] = attr[2];
    }
    alarms.push(alarm);
  }
  return alarms;
}

export async function readAlarms(player: any): Promise<SoapResult> {
  const service = 'urn:schemas-upnp-org:service:AlarmClock:1';
  try {
    const result = await invoke(player, '/AlarmClock/Control', service, 'ListAlarms', '<ID>0</ID>');
    return {
      supported: true,
      value: parseAlarmXml(result && result.currentalarmlist)
    };
  } catch (err) {
    return { supported: false, error: (err as Error).message };
  }
}
