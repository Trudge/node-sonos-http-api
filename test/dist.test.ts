import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const distRouter = path.resolve(__dirname, '..', 'dist', 'src', 'http', 'router.js');

test('compiled build contains registered actions', { skip: !fs.existsSync(distRouter) }, () => {
  const HttpAPI = require(distRouter);
  const discovery: any = new EventEmitter();
  discovery.zones = [];
  discovery.players = [];
  discovery.getAnyPlayer = () => null;
  discovery.getPlayer = () => null;
  const api = new HttpAPI(discovery, { port: 5005, webroot: process.cwd(), presetDir: process.cwd() });
  const actions = (api as any).actions;
  assert.strictEqual(typeof actions.zones, 'function');
  assert.strictEqual(typeof actions.state, 'function');
  assert.strictEqual(typeof actions.report, 'function');
});
