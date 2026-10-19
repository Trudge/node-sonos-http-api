import test from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';
const HttpAPI = require('../src/http/router');

function fakeResponse() {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  const res: any = {
    statusCode: 200,
    setHeader: (name: string, value: string) => { headers[name] = value; },
    write: (chunk: any) => { chunks.push(Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)); },
    end: (body?: any) => { if (body) chunks.push(String(body)); },
    on: () => undefined
  };
  return { res, headers, body: () => chunks.join('') };
}

function wait(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeApi(zones: any[] = []) {
  const discovery: any = new EventEmitter();
  discovery.zones = zones;
  discovery.players = zones.flatMap((zone) => zone.members);
  const anyPlayer = zones[0] ? zones[0].coordinator : null;
  discovery.getAnyPlayer = () => anyPlayer;
  discovery.getPlayer = (name: string) => discovery.players.find(
    (player: any) => player.roomName.toLowerCase() === String(name).toLowerCase()
  );
  const settings = { port: 5005, webroot: process.cwd(), presetDir: process.cwd() };
  return { api: new HttpAPI(discovery, settings), discovery };
}

function makeZone() {
  const coordinator: any = {
    uuid: 'uuid-1',
    roomName: 'Office',
    state: { volume: 10 },
    groupState: { volume: 10, mute: false },
    coordinator: null,
    system: null
  };
  coordinator.coordinator = coordinator;
  const zone = { uuid: 'uuid-1', coordinator, members: [coordinator] };
  coordinator.system = {
    zones: [zone],
    players: [coordinator],
    getAnyPlayer: () => coordinator
  };
  return { zone, coordinator };
}

test('router returns 500 when no system is discovered', async () => {
  const { api } = makeApi([]);
  const response = fakeResponse();
  api.requestHandler({ url: '/zones', headers: {} }, response.res);
  await wait();
  assert.strictEqual(response.res.statusCode, 500);
  assert.match(response.body(), /No system has yet been discovered/);
});

test('router dispatches a read-only action and rejects unknown actions', async () => {
  const { zone } = makeZone();
  const { api } = makeApi([zone]);

  const zonesResponse = fakeResponse();
  api.requestHandler({ url: '/zones', headers: {} }, zonesResponse.res);
  await wait();
  assert.strictEqual(zonesResponse.res.statusCode, 200);
  assert.match(zonesResponse.body(), /RINCON|uuid-1/);

  const unknownResponse = fakeResponse();
  api.requestHandler({ url: '/nope', headers: {} }, unknownResponse.res);
  await wait();
  assert.strictEqual(unknownResponse.res.statusCode, 500);
  assert.match(unknownResponse.body(), /not found/);
});

test('router handles favicon and event stream paths', () => {
  const { api } = makeApi([]);
  const favicon = fakeResponse();
  api.requestHandler({ url: '/favicon.ico', headers: {} }, favicon.res);
  assert.strictEqual(favicon.res.statusCode, 200);

  const eventRes = fakeResponse();
  api.requestHandler({ url: '/events', headers: {} }, eventRes.res);
  assert.strictEqual(eventRes.headers['Content-Type'], 'text/event-stream');
});
