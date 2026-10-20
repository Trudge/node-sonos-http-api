import test from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';

const EXPECTED_ACTIONS = [
  'add', 'aldilifemusic', 'amazonmusic', 'applemusic', 'bass', 'bbcsounds',
  'clearqueue', 'clip', 'clipall', 'clippreset', 'crossfade', 'debug',
  'favorite', 'favorites', 'favourite', 'favourites', 'groupmute',
  'groupunmute', 'groupvolume', 'isolate', 'join', 'leave', 'linein',
  'lockvolumes', 'musicsearch', 'mute', 'mutegroup', 'napster', 'next',
  'nightmode', 'pause', 'pauseall', 'play', 'playlist', 'playlists',
  'playpause', 'preset', 'previous', 'queue', 'reindex', 'repeat', 'report',
  'resumeall', 'say', 'sayall', 'saypreset', 'seek', 'services',
  'setavtransporturi', 'shuffle', 'siriusxm', 'sleep', 'speechenhancement',
  'spotify', 'state', 'sub', 'timeseek', 'togglemute', 'trackseek', 'treble',
  'tunein', 'ungroup', 'unlockvolumes', 'unmute', 'unmutegroup', 'volume',
  'zones'
];

function stubModule(modulePath: string, exports: unknown): void {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } as NodeModule;
}

stubModule('../lib/helpers/file-duration', async () => 100);
stubModule('../lib/helpers/try-download-tts', async () => ({ uri: '/tts/test.mp3', duration: 100 }));
stubModule('../lib/helpers/single-player-announcement', async () => undefined);
stubModule('../lib/helpers/all-player-announcement', async () => undefined);
stubModule('../lib/helpers/preset-announcement', async () => undefined);
stubModule('../src/report', {
  handleReport: async (_player: unknown, values: string[]) => ({ report: values[0] || 'summary' })
});

const HttpAPI = require('../src/http/router');
const libraryDef = require('../lib/music_services/libraryDef');

function makePlayer(): any {
  const calls: string[] = [];
  const record = (name: string) => (..._args: unknown[]) => {
    calls.push(name);
    return Promise.resolve(name === 'addURIToQueue' ? { firsttracknumberenqueued: 1 } : { name });
  };

  const state = {
    volume: 20,
    mute: false,
    playbackState: 'PLAYING',
    trackNo: 1,
    elapsedTime: 0,
    playMode: { repeat: 'all', shuffle: false, crossfade: false },
    equalizer: { nightMode: false, speechEnhancement: false, bass: 0, treble: 0, loudness: true },
    currentTrack: { title: 'Track', artist: 'Artist', album: 'Album' },
    nextTrack: {}
  };

  const player: any = new EventEmitter();
  Object.assign(player, {
    uuid: 'uuid-1',
    roomName: 'Office',
    baseUrl: 'http://127.0.0.1:1',
    state,
    hasSub: true,
    outputFixed: false,
    avTransportUri: 'x-rincon-queue:uuid-1#0',
    avTransportUriMetadata: '',
    enqueuedTransportUri: '',
    enqueuedTransportUriMetadata: '',
    currentPlayMode: state.playMode,
    groupState: { volume: 20, mute: false },
    airPlayEnabled: true,
    micEnabled: false,
    wifiEnabled: true,
    wirelessMode: 0,
    roomCalibrationState: '',
    hdmiCecAvailable: false,
    _state: state,
    play: record('play'),
    pause: record('pause'),
    stop: record('stop'),
    nextTrack: record('nextTrack'),
    previousTrack: record('previousTrack'),
    mute: record('mute'),
    unMute: record('unMute'),
    muteGroup: record('muteGroup'),
    unMuteGroup: record('unMuteGroup'),
    setVolume: record('setVolume'),
    setGroupVolume: record('setGroupVolume'),
    setBass: record('setBass'),
    setTreble: record('setTreble'),
    timeSeek: record('timeSeek'),
    trackSeek: record('trackSeek'),
    clearQueue: record('clearQueue'),
    addURIToQueue: record('addURIToQueue'),
    setAVTransport: record('setAVTransport'),
    repeat: record('repeat'),
    shuffle: record('shuffle'),
    crossfade: record('crossfade'),
    sleep: record('sleep'),
    becomeCoordinatorOfStandaloneGroup: record('standalone'),
    nightMode: record('nightMode'),
    speechEnhancement: record('speechEnhancement'),
    subEnable: record('subEnable'),
    subDisable: record('subDisable'),
    subGain: record('subGain'),
    subCrossover: record('subCrossover'),
    subPolarity: record('subPolarity'),
    replaceWithFavorite: record('replaceWithFavorite'),
    replaceWithPlaylist: record('replaceWithPlaylist'),
    browse: async (objectId: string, startIndex: number, limit: number) => {
      if (objectId === 'A:TRACKS') {
        return {
          items: [{
            uri: 'x-sonos-http:song%3a1.mp4',
            artist: 'Artist',
            album: 'Album',
            title: 'Track',
            albumTrackNumber: 1
          }],
          startIndex,
          numberReturned: 1,
          totalMatches: 1
        };
      }
      if (objectId === 'Q:0') {
        return { items: [], startIndex, numberReturned: 0, totalMatches: 0, limit };
      }
      return { items: [], startIndex, numberReturned: 0, totalMatches: 0, limit };
    },
    getQueue: async () => [{ title: 'Track', artist: 'Artist', album: 'Album' }]
  });
  player.coordinator = player;
  return { player, calls };
}

function makeSystem(player: any): any {
  const system: any = new EventEmitter();
  Object.assign(system, {
    zones: [{ uuid: player.uuid, id: 'zone-1', coordinator: player, members: [player] }],
    players: [player],
    localEndpoint: '127.0.0.1',
    availableServices: { Spotify: { id: 9, type: 52231, capabilities: 0 } },
    getPlayer: (name: string) => (name === 'Office' ? player : undefined),
    getAnyPlayer: () => player,
    getPlayerByUUID: () => player,
    getFavorites: async () => [{ title: 'Favourite', uri: 'x-rincon-queue:uuid-1#0' }],
    getPlaylists: async () => [{ title: 'Playlist', uri: 'x-rincon-queue:uuid-1#0' }],
    getServiceId: () => 9,
    getServiceType: () => 52231,
    applyPreset: async () => undefined,
    refreshShareIndex: async () => undefined
  });
  player.system = system;
  return system;
}

function makeResponse(): any {
  const chunks: Buffer[] = [];
  return {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    setHeader(name: string, value: unknown) {
      this.headers[name] = value;
    },
    write(chunk: unknown) {
      chunks.push(Buffer.from(chunk as Buffer));
    },
    end(chunk?: unknown) {
      if (chunk) chunks.push(Buffer.from(chunk as Buffer));
      this.body = Buffer.concat(chunks).toString();
      this.done();
    },
    done: () => undefined,
    body: ''
  };
}

function request(api: any, url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve) => {
    const res = makeResponse();
    res.done = () => resolve({ statusCode: res.statusCode, body: res.body });
    api.requestHandler(
      { url, method: 'GET', headers: {}, socket: { remoteAddress: '127.0.0.1' } },
      res
    );
  });
}

test('all known actions are registered', async () => {
  const { player } = makePlayer();
  const system = makeSystem(player);
  const api = new HttpAPI(system, { port: 5005, webroot: process.cwd(), presetDir: process.cwd() });
  const actions = (api as any).actions;
  for (const endpoint of EXPECTED_ACTIONS) {
    assert.strictEqual(typeof actions[endpoint], 'function', `${endpoint} should be registered`);
  }
});

test('every action dispatches through the HTTP router', async () => {
  const { player, calls } = makePlayer();
  const system = makeSystem(player);
  const api = new HttpAPI(system, { port: 5005, webroot: process.cwd(), presetDir: process.cwd() });

  await libraryDef.load(player, true);

  const requests = [
    'zones', 'state', 'debug', 'queue/10/0', 'favorites/detailed', 'favourites/detailed', 'playlists/detailed',
    'services/all', 'report', 'report/summary', 'report/export', 'preset', 'preset/example',
    'playpause', 'play', 'pause', 'next', 'previous', 'pauseall', 'resumeall',
    'lockvolumes', 'unlockvolumes',
    'volume/20', 'groupvolume/20', 'mute', 'unmute', 'togglemute',
    'groupmute', 'groupunmute', 'mutegroup', 'unmutegroup',
    'repeat/toggle', 'shuffle/toggle', 'crossfade/toggle',
    'bass/1', 'treble/1', 'nightmode/toggle', 'speechenhancement/toggle',
    'seek/10', 'timeseek/10', 'trackseek/2', 'sleep/10', 'sleep/off',
    'clearqueue', 'reindex', 'favorite/Fav', 'favourite/Fav', 'playlist/List', 'linein/Office',
    'add/Office', 'join/Office', 'isolate', 'ungroup', 'leave',
    'sub/on', 'sub/gain/3', `setavtransporturi/${encodeURIComponent('x-rincon-queue:uuid-1#0')}`,
    `spotify/queue/${encodeURIComponent('spotify:track:abc')}`,
    'tunein/play/44491', 'applemusic/queue/song:123', 'amazonmusic/queue/song:123',
    'aldilifemusic/queue/song:123', 'napster/queue/song:123',
    'bbcsounds/play/bbc_6music', 'siriusxm/10', 'musicsearch/library/song/Track',
    'clip/sample_clip.mp3', 'clipall/sample_clip.mp3', 'say/hello', 'sayall/hello',
    'clippreset/example/sample_clip.mp3', 'saypreset/example/hello'
  ];

  for (const endpoint of requests) {
    const response = await request(api, `/${endpoint}`);
    assert.strictEqual(response.statusCode, 200, `${endpoint} should return 200: ${response.body}`);
    const body = JSON.parse(response.body);
    assert.ok(!('error' in body), `${endpoint} should not return an error: ${response.body}`);
  }

  assert.ok(calls.includes('setAVTransport'));
  assert.ok(calls.includes('addURIToQueue'));
  assert.ok(calls.includes('play'));
});
