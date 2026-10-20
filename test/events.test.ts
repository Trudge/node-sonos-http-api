import test from 'node:test';
import assert from 'node:assert';
const HttpEventServer = require('../src/http/events');

function fakeResponse() {
  const headers: Record<string, string> = {};
  const writes: string[] = [];
  let closeHandler: (() => void) | undefined;
  let closed = false;
  const res: any = {
    statusCode: 200,
    setHeader: (name: string, value: string) => { headers[name] = value; },
    write: (chunk: string) => { writes.push(chunk); },
    end: (body?: string) => { if (body) writes.push(body); },
    on: (event: string, cb: () => void) => {
      if (event === 'close') closeHandler = cb;
    },
    headers,
    writes
  };
  return {
    res,
    headers,
    writes,
    isClosed: () => closed,
    close: () => { closed = true; if (closeHandler) closeHandler(); }
  };
}

test('event server sends events and caps subscribers', async () => {
  const events = new HttpEventServer();
  const created = [];
  const first = fakeResponse();
  created.push(first);
  events.addClient(first.res);
  events.sendEvent('{"type":"test"}');
  assert.match(first.writes.join(''), /data: \{"type":"test"\}/);
  assert.strictEqual(first.headers['Content-Type'], 'text/event-stream');

  for (let i = 0; i < 100; i += 1) {
    const client = fakeResponse();
    created.push(client);
    events.addClient(client.res);
  }
  const overflow = fakeResponse();
  created.push(overflow);
  events.addClient(overflow.res);
  assert.strictEqual(overflow.res.statusCode, 503);
  assert.match(overflow.writes.join(''), /Too many event subscribers/);
  created.forEach((client) => { client.close(); });
});
