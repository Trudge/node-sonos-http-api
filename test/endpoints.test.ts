import test from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';
const HttpAPI = require('../src/http/router');

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

function registeredActions(): Record<string, unknown> {
  const discovery: any = new EventEmitter();
  discovery.zones = [];
  discovery.players = [];
  discovery.getAnyPlayer = () => null;
  discovery.getPlayer = () => null;
  const api = new HttpAPI(discovery, { port: 5005, webroot: process.cwd(), presetDir: process.cwd() });
  return (api as any).actions;
}

const actions = registeredActions();

for (const endpoint of EXPECTED_ACTIONS) {
  test(`endpoint ${endpoint} is registered`, () => {
    assert.strictEqual(typeof actions[endpoint], 'function');
  });
}
