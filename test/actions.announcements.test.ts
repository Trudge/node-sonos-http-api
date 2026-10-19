import test from 'node:test';
import assert from 'node:assert';

function load(name: string): Record<string, (player: any, values: string[]) => Promise<any>> {
  const handlers: Record<string, any> = {};
  require(`../lib/actions/${name}`)({
    getPort: () => 5005,
    discovery: { localEndpoint: '127.0.0.1' },
    registerAction: (action: string, fn: any) => { handlers[action] = fn; }
  });
  return handlers;
}

const player: any = {
  system: { localEndpoint: '127.0.0.1' },
  coordinator: { uuid: 'uuid-1' }
};

test('clip actions reject path traversal before reading files', async () => {
  await assert.rejects(() => load('clip').clip(player, ['../../etc/passwd']), /Clip path|Unsupported/);
  await assert.rejects(() => load('clipall').clipall(player, ['../../etc/passwd']), /Clip path|Unsupported/);
  await assert.rejects(() => load('clippreset').clippreset(player, ['missing', '../../etc/passwd']), /No preset/);
});

test('say actions reject malformed encoding', async () => {
  await assert.rejects(() => load('say').say(player, ['%ZZ']), /URI|decode/i);
  await assert.rejects(() => load('sayall').sayall(player, ['%ZZ']), /URI|decode/i);
  await assert.rejects(() => load('saypreset').saypreset(player, ['missing', 'hello']), /No preset/);
});
