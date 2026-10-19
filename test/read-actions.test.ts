import test from 'node:test';
import assert from 'node:assert';

function load(name: string): { handler: (player: any, values: string[]) => any } {
  let handler: any;
  const register = require(`../lib/actions/${name}`);
  register({ registerAction: (_name: string, fn: any) => { handler = fn; } });
  return { handler };
}

function makePlayer() {
  const state = { playbackState: 'PLAYING', volume: 10, trackNo: 1 };
  const coordinator: any = {
    uuid: 'uuid-1',
    roomName: 'Office',
    state,
    groupState: { volume: 10, mute: false },
    getQueue: async () => [{ title: 'Track', artist: 'Artist', album: 'Album' }]
  };
  coordinator.coordinator = coordinator;
  const system: any = {
    zones: [{ uuid: 'uuid-1', coordinator, members: [coordinator] }],
    availableServices: { Spotify: { id: 1 } },
    getFavorites: async () => [{ title: 'Favourite' }],
    getPlaylists: async () => [{ title: 'Playlist' }]
  };
  coordinator.system = system;
  return { player: coordinator, system };
}

test('zones and state actions return read-only data', async () => {
  const { player } = makePlayer();
  const zones = load('zones').handler(player, []);
  const result = await zones;
  assert.strictEqual(result[0].coordinator.roomName, 'Office');
  assert.strictEqual(await load('state').handler(player, []), player.state);
});

test('queue, favorites, playlists, and services actions', async () => {
  const { player } = makePlayer();
  const queue = await load('queue').handler(player, []);
  assert.strictEqual(queue[0].title, 'Track');

  const favorites = await load('favorites').handler(player, []);
  assert.deepStrictEqual(favorites, ['Favourite']);

  const playlists = await load('playlists').handler(player, []);
  assert.deepStrictEqual(playlists, ['Playlist']);

  const services = await load('services').handler(player, ['all']);
  assert.deepStrictEqual(services, { Spotify: { id: 1 } });
});
