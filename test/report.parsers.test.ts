import test from 'node:test';
import assert from 'node:assert';
import { parseIdentityXml } from '../src/report/identity';
import { capabilityFlags } from '../src/report/index';
import { parseAlarmXml } from '../src/report/upnp';

const DEVICE_XML = `<?xml version="1.0"?>
<root>
  <device>
    <UDN>uuid:RINCON_TEST</UDN>
    <modelName>Sonos Five</modelName>
    <modelNumber>S24</modelNumber>
    <displayName>Five</displayName>
    <roomName>Office</roomName>
    <serialNum>ABC123</serialNum>
    <softwareVersion>80.1-12345</softwareVersion>
    <hardwareVersion>1.2.3</hardwareVersion>
    <MACAddress>AA:BB:CC:DD:EE:FF</MACAddress>
    <zoneType>1</zoneType>
    <serviceList>
      <service><serviceType>urn:schemas-upnp-org:service:AlarmClock:1</serviceType></service>
      <service><serviceType>urn:schemas-upnp-org:service:AudioIn:1</serviceType></service>
      <service><serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType></service>
      <service><serviceType>urn:schemas-upnp-org:service:HTControl:1</serviceType></service>
    </serviceList>
  </device>
</root>`;

test('device_description.xml parser extracts identity and services', () => {
  const identity = parseIdentityXml(DEVICE_XML);
  assert.strictEqual(identity.available, true);
  assert.strictEqual(identity.udn, 'uuid:RINCON_TEST');
  assert.strictEqual(identity.modelName, 'Sonos Five');
  assert.strictEqual(identity.modelNumber, 'S24');
  assert.strictEqual(identity.serialNumber, 'ABC123');
  assert.strictEqual(identity.softwareVersion, '80.1-12345');
  assert.strictEqual(identity.roomName, 'Office');
  assert.strictEqual(identity.services.length, 4);
});

test('capability flags are derived from service types', () => {
  const identity = parseIdentityXml(DEVICE_XML);
  const flags = capabilityFlags(identity);
  assert.strictEqual(flags.alarmClock, true);
  assert.strictEqual(flags.audioIn, true);
  assert.strictEqual(flags.contentDirectory, true);
  assert.strictEqual(flags.htControl, true);
  assert.strictEqual(flags.groupRenderingControl, false);
});

test('alarm XML parser extracts alarm attributes', () => {
  const xml = '<Alarms><Alarm ID="2" StartTime="06:00:00" Duration="02:00:00" Recurrence="WEEKDAYS" Enabled="0" RoomUUID="RINCON_TEST" /></Alarms>';
  const alarms = parseAlarmXml(xml);
  assert.strictEqual(alarms.length, 1);
  assert.strictEqual(alarms[0].ID, '2');
  assert.strictEqual(alarms[0].StartTime, '06:00:00');
  assert.strictEqual(alarms[0].Recurrence, 'WEEKDAYS');
  assert.strictEqual(alarms[0].Enabled, '0');
});

test('alarm XML parser tolerates invalid input', () => {
  assert.deepStrictEqual(parseAlarmXml(null), []);
  assert.deepStrictEqual(parseAlarmXml('<Alarms></Alarms>'), []);
});
