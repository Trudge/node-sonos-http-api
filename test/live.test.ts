import test from 'node:test';
import assert from 'node:assert';

interface LivePlayer {
  uuid: string;
  coordinator: {
    roomName: string;
  };
}

const BASE = process.env.SONOS_LIVE_URL || 'http://127.0.0.1:5005';
let available = false;
let players: LivePlayer[] = [];

test.before(async () => {
  try {
    const response = await fetch(`${BASE}/zones`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return;
    players = await response.json() as LivePlayer[];
    available = Array.isArray(players) && players.length > 0;
  } catch {
    available = false;
  }
});

test('live /zones returns detected players', async (t) => {
  if (!available) return t.skip('no live Sonos API available');
  assert.ok(players.length > 0);
  assert.ok(players.every((player) => player.uuid && player.coordinator));
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

test('live player report endpoints respond', async (t) => {
  if (!available) return t.skip('no live Sonos API available');

  for (const player of players) {
    const room = encodeURIComponent(player.coordinator.roomName);

    for (const suffix of ['state', 'capabilities', 'queue/5/0']) {
      await t.test(`${player.uuid} report ${suffix}`, async () => {
        const response = await fetch(`${BASE}/report/players/${room}/${suffix}`, {
          signal: AbortSignal.timeout(15000)
        });
        assert.strictEqual(response.status, 200);
        await response.json();
      });
    }

    await t.test(`${player.uuid} report library`, async () => {
      const response = await fetch(`${BASE}/report/library/${room}/A%3A/0/5`, {
        signal: AbortSignal.timeout(15000)
      });
      assert.strictEqual(response.status, 200);
      await response.json();
    });

    for (const endpoint of ['state', 'queue/5/0', 'favorites', 'favourites', 'playlists', 'services/all', 'debug']) {
      await t.test(`${player.uuid} ${endpoint}`, async () => {
        const response = await fetch(`${BASE}/${room}/${endpoint}`, {
          signal: AbortSignal.timeout(15000)
        });
        assert.strictEqual(response.status, 200);
        await response.json();
      });
    }
  }
});

test('live global read-only endpoints respond', async (t) => {
  if (!available) return t.skip('no live Sonos API available');

  for (const endpoint of ['/debug', '/preset', '/favorites/detailed', '/playlists/detailed', '/services/all']) {
    await t.test(endpoint, async () => {
      const response = await fetch(`${BASE}${endpoint}`, { signal: AbortSignal.timeout(15000) });
      assert.strictEqual(response.status, 200);
      await response.json();
    });
  }
});
