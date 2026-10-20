import path = require('node:path');
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Settings } from '../types/settings';
import type { ActionHandler, PlayerLike, SonosSystemLike } from '../types/actions';
import requireDir = require('../../lib/helpers/require-dir');
import request = require('sonos-discovery/lib/helpers/request');
import logger = require('sonos-discovery/lib/helpers/logger');
import HttpEventServer = require('./events');

interface ActionOptions {
  action: string;
  values: string[];
  player: PlayerLike;
}

function isStream(value: unknown): boolean {
  return Boolean(value) && typeof (value as { pipe?: unknown }).pipe === 'function';
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; error?: unknown };
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error === 'string') return value.error;
  }
  return 'Unknown error';
}

class HttpAPI {
  private actions: Record<string, ActionHandler> = Object.create(null);
  private events = new HttpEventServer();
  private discovery: SonosSystemLike;
  private port: number;
  private settings: Settings;

  constructor(discovery: SonosSystemLike, settings: Settings) {
    this.discovery = discovery;
    this.settings = settings;
    this.port = settings.port;

    discovery.on('transport-state', (player: unknown) => this.invokeWebhook('transport-state', player));
    discovery.on('topology-change', (topology: unknown) => this.invokeWebhook('topology-change', topology));
    discovery.on('volume-change', (volumeChange: unknown) => this.invokeWebhook('volume-change', volumeChange));
    discovery.on('mute-change', (muteChange: unknown) => this.invokeWebhook('mute-change', muteChange));

    requireDir(path.join(__dirname, '../../lib/actions'), (registerAction: (api: HttpAPI) => void) => {
      registerAction(this);
    });
  }

  getWebRoot(): string {
    return this.settings.webroot;
  }

  getPort(): number {
    return this.port;
  }

  registerAction(action: string, handler: ActionHandler): void {
    this.actions[action] = handler;
  }

  requestHandler(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url || '/';
    const pathname = url.split('?')[0];

    if (pathname === '/favicon.ico') {
      res.end();
      return;
    }

    if (pathname === '/events') {
      this.events.addClient(res);
      return;
    }

    if (this.discovery.zones.length === 0) {
      const msg = 'No system has yet been discovered. Please see https://github.com/jishi/node-sonos-http-api/issues/77 if it doesn\'t resolve itself in a few seconds.';
      logger.error(msg);
      this.sendResponse(res, 500, { status: 'error', error: msg });
      return;
    }

    const params = pathname.substring(1).split('/');
    let player: PlayerLike | undefined;
    try {
      player = this.discovery.getPlayer(decodeURIComponent(params[0] || ''));
    } catch (error) {
      logger.error(`Unable to parse supplied URI component (${params[0]})`, error);
      this.sendResponse(res, 500, { status: 'error', error: errorMessage(error) });
      return;
    }

    let action: string;
    let values: string[];
    if (player) {
      action = (params[1] || '').toLowerCase();
      values = params.splice(2);
    } else {
      player = this.discovery.getAnyPlayer();
      action = (params[0] || '').toLowerCase();
      values = params.splice(1);
    }

    if (!player) {
      this.sendResponse(res, 500, { status: 'error', error: 'No player available' });
      return;
    }

    const options: ActionOptions = { action, values, player };
    Promise.resolve()
      .then(() => this.handleAction(options))
      .then((response: unknown) => {
        const body = !response || isStream(response)
          || (Array.isArray(response) && response.length > 0 && isStream(response[0]))
          ? { status: 'success' }
          : response;
        this.sendResponse(res, 200, body);
      })
      .catch((error: unknown) => {
        logger.error(error);
        const statusCode = error && typeof error === 'object'
          ? Number((error as { statusCode?: unknown }).statusCode) || 500
          : 500;
        this.sendResponse(res, statusCode, { status: 'error', error: errorMessage(error) });
      });
  }

  private sendResponse(res: ServerResponse, code: number, body: unknown): void {
    const jsonResponse = JSON.stringify(body) ?? 'null';
    res.statusCode = code;
    res.setHeader('Content-Length', Buffer.byteLength(jsonResponse));
    res.setHeader('Content-Type', 'application/json;charset=utf-8');
    res.write(Buffer.from(jsonResponse));
    res.end();
  }

  private handleAction(options: ActionOptions): Promise<unknown> | unknown {
    const action = this.actions[options.action];
    if (!Object.hasOwn(this.actions, options.action) || !action) {
      return Promise.reject({ error: `action '${options.action}' not found` });
    }
    return action(options.player, options.values);
  }

  private invokeWebhook(type: string, data: unknown): void {
    let typeName = 'type';
    let dataName = 'data';
    if (this.settings.webhookType) typeName = String(this.settings.webhookType);
    if (this.settings.webhookData) dataName = String(this.settings.webhookData);

    const jsonBody = JSON.stringify({ [typeName]: type, [dataName]: data });
    this.events.sendEvent(jsonBody);

    const webhook = this.settings.webhook;
    if (!webhook) return;

    const body = Buffer.from(jsonBody, 'utf8');
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Content-Length': body.length
    };
    if (this.settings.webhookHeaderName && this.settings.webhookHeaderContents) {
      headers[String(this.settings.webhookHeaderName)] = String(this.settings.webhookHeaderContents);
    }

    request({
      method: 'POST',
      uri: String(webhook),
      headers,
      body,
      timeout: 5000
    }).catch(() => {
      logger.error('Could not reach the configured webhook endpoint. Verify that the receiving end is up and running.');
    });
  }
}

export = HttpAPI;
