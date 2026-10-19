import test from 'node:test';
import assert from 'node:assert';

const BASE = process.env.SONOS_LIVE_URL || 'http://127.0.0.1:5005';
let available = false;
let players: any[] = [];

test.before(async () => {
  try {
    const response = await fetch(`${BASE}/zones`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return;
    players = await response.json();
    available = Array.isArray(players) && players.length > 0;
  } catch (err) {
    available = false;
  }
});

test('live /zones returns detected players', async (t) => {
  if (!available) return t.skip('no live Sonos API available');
  assert.ok(players.length > 0);
  assert.ok(players.every((player: any) => player.uuid && player.coordinator));
});

const reportEndpoints = [
  '/report/summary', '/report/system', '/report/zones', '/report/groups',
  '/report/players', '/report/sources', '/report/favorites', '/report/playlists',
  '/report/services', '/report/alarms', '/report/diagnostics', '/report/export'
];

for (const endpoint of reportEndpoints) {
  test(`live ${endpoint} responds`, async (t) => {
    if (!available) return t.skip('no live Sonos API available');
    const response = await fetch(`${BASE}${endpoint}`, { signal: AbortSignal.timeout(15000) });
    assert.strictEqual(response.status, 200);
    await response.json();
  });
}

for (const player of players) {
  const room = encodeURIComponent(player.coordinator.roomName);
  for (const suffix of ['state', 'capabilities', 'queue/5/0']) {
    test(`live player ${player.uuid} ${suffix} responds`, async (t) => {
      if (!available) return t.skip('no live Sonos API available');
      const response = await fetch(`${BASE}/report/players/${room}/${suffix}`, { signal: AbortSignal.timeout(15000) });
      assert.strictEqual(response.status, 200);
      await response.json();
    });
  }
  test(`live library for ${player.uuid} responds`, async (t) => {
    if (!available) return t.skip('no live Sonos API available');
    const response = await fetch(`${BASE}/report/library/${room}/A%3A/0/5`, { signal: AbortSignal.timeout(15000) });
    assert.strictEqual(response.status, 200);
    await response.json();
  });
}
