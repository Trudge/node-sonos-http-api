'use strict';
const test = require('node:test');
const assert = require('node:assert');
const registerReport = require('../lib/actions/report');

function makeSystem() {
  const state = {
    playbackState: 'PLAYING',
    volume: 20,
    mute: false,
    equalizer: { bass: 0, treble: 0, loudness: true },
    currentTrack: { title: 'Track', artist: 'Artist', album: 'Album' },
    nextTrack: {},
    elapsedTime: 10,
    playMode: { repeat: 'none', shuffle: false, crossfade: false },
    trackNo: 1
  };
  const coordinator = {
    uuid: 'uuid-1',
    roomName: 'Office',
    baseUrl: 'http://127.0.0.1:1',
    hasSub: false,
    airPlayEnabled: true,
    micEnabled: false,
    wifiEnabled: true,
    wirelessMode: 0,
    roomCalibrationState: '',
    hdmiCecAvailable: false,
    outputFixed: false,
    groupState: { volume: 20, mute: false },
    state,
    avTransportUri: 'x-rincon-queue:uuid-1#0',
    getQueue: async () => [
      { title: 'Track', artist: 'Artist', album: 'Album', albumArtUri: '' }
    ],
    browse: async (objectId, startIndex, limit) => ({
      objectId,
      startIndex,
      limit,
      items: [{ title: 'Album' }],
      totalMatches: 1,
      numberReturned: 1
    })
  };
  coordinator.coordinator = coordinator;
  const system = {
    localEndpoint: '192.168.1.10',
    players: [coordinator],
    zones: [{ uuid: 'uuid-1', coordinator, members: [coordinator] }],
    availableServices: { Spotify: { id: 9 } },
    getAnyPlayer: () => coordinator,
    getPlayer: (name) => (name.toLowerCase() === 'office' ? coordinator : undefined),
    getFavorites: async () => [{ title: 'Fav' }],
    getPlaylists: async () => [{ title: 'List' }]
  };
  return system;
}

function getHandler() {
  let handler;
  registerReport({ registerAction: (name, fn) => { if (name === 'report') handler = fn; } });
  assert.ok(handler);
  return handler;
}

test('report summary and zones are read-only', async () => {
  const handler = getHandler();
  const system = makeSystem();
  const summary = await handler({ system }, ['summary']);
  assert.strictEqual(summary.playerCount, 1);
  assert.strictEqual(summary.zoneCount, 1);

  const zones = await handler({ system }, ['zones']);
  assert.strictEqual(zones[0].coordinator.roomName, 'Office');
  assert.strictEqual(zones[0].members.length, 1);
  assert.strictEqual(zones[0].coordinator.source.isQueue, true);
});

test('report queue and library pagination are exposed', async () => {
  const handler = getHandler();
  const system = makeSystem();
  const queue = await handler({ system }, ['players', 'office', 'queue', '10', '0']);
  assert.strictEqual(queue.count, 1);
  assert.strictEqual(queue.trackNo, 1);

  const library = await handler({ system }, ['library', 'office', 'A:ALBUM', '0', '50']);
  assert.strictEqual(library.objectId, 'A:ALBUM');
  assert.strictEqual(library.limit, 50);
});

test('report sources and diagnostics do not expose secrets', async () => {
  const handler = getHandler();
  const system = makeSystem();
  const sources = await handler({ system }, ['sources']);
  assert.strictEqual(sources[0].source.isQueue, true);
  const diagnostics = await handler({ system }, ['diagnostics']);
  assert.deepStrictEqual(diagnostics.services, ['Spotify']);
  assert.strictEqual(diagnostics.players[0].roomName, 'Office');
});

test('unknown reports return a 404-style error', async () => {
  const handler = getHandler();
  const system = makeSystem();
  await assert.rejects(() => handler({ system }, ['nope']), /Unknown report/);
});
