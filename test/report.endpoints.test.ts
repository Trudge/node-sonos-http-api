import test from 'node:test';
import assert from 'node:assert';

const registerReport = require('../lib/actions/report');

let handler: any;
registerReport({ registerAction: (_name: string, fn: any) => { handler = fn; } });

function makeSystem() {
  const state = {
    playbackState: 'PLAYING', volume: 10, mute: false,
    equalizer: { bass: 0, treble: 0, loudness: true },
    currentTrack: { title: 'Track' }, nextTrack: {},
    elapsedTime: 1, playMode: {}, trackNo: 1
  };
  const coordinator: any = {
    uuid: 'uuid-1', roomName: 'Office', baseUrl: 'http://127.0.0.1:1',
    hasSub: false, state, avTransportUri: 'x-rincon-queue:uuid-1#0',
    groupState: { volume: 10, mute: false },
    getQueue: async () => [{ title: 'Track' }],
    browse: async (objectId: string, startIndex: number, limit: number) => ({
      objectId, startIndex, limit, items: [], totalMatches: 0, numberReturned: 0
    })
  };
  coordinator.coordinator = coordinator;
  const system: any = {
    localEndpoint: '127.0.0.1', players: [coordinator],
    zones: [{ uuid: 'uuid-1', coordinator, members: [coordinator] }],
    availableServices: { Spotify: { id: 1 } },
    getAnyPlayer: () => coordinator,
    getPlayer: (name: string) => (name.toLowerCase() === 'office' ? coordinator : undefined),
    getFavorites: async () => [], getPlaylists: async () => []
  };
  coordinator.system = system;
  return system;
}

const routes: Array<[string, string[]]> = [
  ['summary', ['summary']],
  ['system', ['system']],
  ['zones', ['zones']],
  ['groups', ['groups']],
  ['players', ['players']],
  ['player', ['players', 'office']],
  ['player-state', ['players', 'office', 'state']],
  ['player-capabilities', ['players', 'office', 'capabilities']],
  ['player-queue', ['players', 'office', 'queue', '5', '0']],
  ['sources', ['sources']],
  ['favorites', ['favorites']],
  ['playlists', ['playlists']],
  ['services', ['services']],
  ['alarms', ['alarms']],
  ['library', ['library', 'office', 'A:', '0', '5']],
  ['diagnostics', ['diagnostics']],
  ['export', ['export']]
];

for (const [name, values] of routes) {
  test(`report endpoint ${name} responds`, async () => {
    const result = await handler({ system: makeSystem() }, values);
    assert.notStrictEqual(result, undefined);
  });
}
