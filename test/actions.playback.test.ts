import test from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';

function load(name: string): Record<string, (player: any, values: string[]) => Promise<any> | any> {
  const handlers: Record<string, any> = {};
  for (const key of Object.keys(require.cache)) {
    if (key.endsWith(`/lib/actions/${name}.ts`) || key.endsWith(`/lib/actions/${name}.js`)) {
      delete require.cache[key];
    }
  }
  require(`../lib/actions/${name}`)({
    registerAction: (action: string, fn: any) => { handlers[action] = fn; }
  });
  return handlers;
}

function makePlayer() {
  const calls: any[] = [];
  const record = (name: string) => (...args: any[]) => {
    calls.push([name, ...args]);
    return Promise.resolve({ name });
  };
  const coordinator: any = {
    uuid: 'uuid-1', roomName: 'Office',
    state: {
      playbackState: 'PLAYING', mute: false, volume: 10,
      playMode: { repeat: 'all', shuffle: false, crossfade: false },
      equalizer: { nightMode: false, speechEnhancement: false }
    },
    groupState: { volume: 10, mute: false },
    play: record('play'), pause: record('pause'), nextTrack: record('next'),
    previousTrack: record('previous'), setGroupVolume: record('setGroupVolume'),
    muteGroup: record('muteGroup'), unMuteGroup: record('unMuteGroup'),
    repeat: record('repeat'), shuffle: record('shuffle'), crossfade: record('crossfade'),
    clearQueue: record('clearQueue'), timeSeek: record('timeSeek'), trackSeek: record('trackSeek'),
    sleep: record('sleep'), setAVTransport: record('setAVTransport'),
    replaceWithFavorite: record('replaceWithFavorite'), replaceWithPlaylist: record('replaceWithPlaylist'),
    subEnable: record('subEnable'), subDisable: record('subDisable'), subGain: record('subGain'),
    subCrossover: record('subCrossover'), subPolarity: record('subPolarity')
  };
  coordinator.coordinator = coordinator;
  const system: any = new EventEmitter();
  system.zones = [{ uuid: 'uuid-1', coordinator }];
  system.players = [coordinator];
  system.availableServices = { Spotify: { id: 1 } };
  system.localEndpoint = '127.0.0.1';
  system.getPlayer = (name: string) => (name === 'Office' ? coordinator : undefined);
  system.getPlayerByUUID = () => coordinator;
  system.applyPreset = record('applyPreset');
  system.refreshShareIndex = record('refreshShareIndex');
  coordinator.system = system;
  const player: any = {
    uuid: 'uuid-1', roomName: 'Office', state: coordinator.state,
    coordinator, system, hasSub: true,
    play: coordinator.play, pause: coordinator.pause,
    mute: record('mute'), unMute: record('unMute'),
    setVolume: record('setVolume'), setBass: record('setBass'), setTreble: record('setTreble'),
    nightMode: record('nightMode'), speechEnhancement: record('speechEnhancement'),
    setAVTransport: coordinator.setAVTransport,
    becomeCoordinatorOfStandaloneGroup: record('standalone'),
    subEnable: coordinator.subEnable, subDisable: coordinator.subDisable,
    subGain: coordinator.subGain, subCrossover: coordinator.subCrossover, subPolarity: coordinator.subPolarity
  };
  return { player, coordinator, system, calls };
}

test('playback and volume actions invoke the expected player methods', async () => {
  const { player, calls } = makePlayer();
  await load('playpause').playpause(player, []);
  await load('volume').volume(player, ['15']);
  await load('seek').timeseek(player, ['30']);
  await load('nextprevious').next(player, []);
  await load('playmode').repeat(player, ['toggle']);
  await load('clearqueue').clearqueue(player, []);
  assert.ok(calls.some(([name]) => name === 'pause'));
  assert.ok(calls.some(([name, value]) => name === 'setVolume' && value === '15'));
  assert.ok(calls.some(([name, value]) => name === 'timeSeek' && value === '30'));
  assert.ok(calls.some(([name]) => name === 'next'));
  assert.ok(calls.some(([name]) => name === 'repeat'));
  assert.ok(calls.some(([name]) => name === 'clearQueue'));
});

test('mute, EQ, sub, group, linein, and transport actions', async () => {
  const { player, calls } = makePlayer();
  await load('mute').mute(player, []);
  await load('equalizer').nightmode(player, ['toggle']);
  await load('sub').sub(player, ['gain', '3']);
  await load('group').add(player, ['Office']);
  await load('linein').linein(player, ['Office']);
  await load('setavtransporturi').setavtransporturi(player, [encodeURIComponent('x-rincon-queue:uuid-1#0')]);
  assert.ok(calls.some(([name]) => name === 'mute'));
  assert.ok(calls.some(([name]) => name === 'nightMode'));
  assert.ok(calls.some(([name]) => name === 'subGain'));
  assert.ok(calls.some(([name]) => name === 'setAVTransport'));
});

test('favorite, playlist, sleep, preset, reindex, and debug actions', async () => {
  const { player } = makePlayer();
  await load('favorite').favorite(player, ['Fav']);
  await load('playlist').playlist(player, ['List']);
  await load('sleep').sleep(player, ['60']);
  await load('preset').preset(player, ['missing']);
  await load('reindex').reindex(player, []);
  const debug = await load('debug').debug(player, []);
  assert.strictEqual(debug.system.localEndpoint, '127.0.0.1');
  assert.strictEqual(debug.players[0].roomName, 'Office');
});

test('lock volumes and pause/resume actions work', async () => {
  const { player } = makePlayer();
  const lock = load('lockvolumes');
  await lock.lockvolumes(player, []);
  await lock.unlockvolumes(player, []);
  const pause = load('pauseall');
  await pause.pauseall(player, []);
  await pause.resumeall(player, []);
});

test('remaining playback branches are covered', async () => {
  const { player, coordinator, system, calls } = makePlayer();

  coordinator.state.playbackState = 'STOPPED';
  await load('playpause').play(player, []);
  await load('playpause').playpause(player, []);
  await load('nextprevious').previous(player, []);
  await load('volume').groupvolume(player, ['20']);
  await load('seek').trackseek(player, ['2']);
  await load('playmode').shuffle(player, ['toggle']);
  await load('playmode').crossfade(player, ['toggle']);

  const mute = load('mute');
  await mute.unmute(player, []);
  await mute.groupmute(player, []);
  await mute.groupunmute(player, []);
  coordinator.state.mute = false;
  await mute.togglemute(player, []);
  coordinator.state.mute = true;
  await mute.togglemute(player, []);

  const eq = load('equalizer');
  await eq.speechenhancement(player, ['toggle']);
  await eq.bass(player, ['2']);
  await eq.treble(player, ['2']);

  const sub = load('sub');
  await sub.sub(player, ['on']);
  await sub.sub(player, ['off']);
  await sub.sub(player, ['crossover', '80']);
  await sub.sub(player, ['polarity', '1']);
  await sub.sub(player, ['bogus']);

  const group = load('group');
  await group.join(player, ['Office']);
  await group.isolate(player, []);
  await group.ungroup(player, []);
  await group.leave(player, []);

  await load('sleep').sleep(player, ['off']);
  await load('sleep').sleep(player, ['bogus']);
  await load('preset').preset(player, [encodeURIComponent('{"players":[]}')]);

  await load('lockvolumes').lockvolumes(player, []);
  system.emit('volume-change', { uuid: 'uuid-1' });
  await load('lockvolumes').unlockvolumes(player, []);
  await load('pauseall').pauseall(player, ['1']);
  await load('pauseall').resumeall(player, ['1']);

  assert.ok(calls.length > 0);
});
