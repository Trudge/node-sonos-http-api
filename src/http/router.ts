import path = require('path');
import type { Settings } from '../types/settings';

const requireDir = require('../../lib/helpers/require-dir');
const request = require('sonos-discovery/lib/helpers/request');
const logger = require('sonos-discovery/lib/helpers/logger');
const HttpEventServer = require('./events');

type ActionHandler = (player: any, values: string[]) => Promise<any> | any;

class HttpAPI {
  private actions: Record<string, ActionHandler> = {};
  private events = new HttpEventServer();
  private discovery: any;
  private port: number;
  private settings: Settings;

  constructor(discovery: any, settings: Settings) {
    this.discovery = discovery;
    this.settings = settings;
    this.port = settings.port;

    discovery.on('transport-state', (player: any) => this.invokeWebhook('transport-state', player));
    discovery.on('topology-change', (topology: any) => this.invokeWebhook('topology-change', topology));
    discovery.on('volume-change', (volumeChange: any) => this.invokeWebhook('volume-change', volumeChange));
    discovery.on('mute-change', (muteChange: any) => this.invokeWebhook('mute-change', muteChange));

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

  requestHandler(req: any, res: any): void {
    if (req.url === '/favicon.ico') {
      res.end();
      return;
    }

    if (req.url === '/events') {
      this.events.addClient(res);
      return;
    }

    if (this.discovery.zones.length === 0) {
      const msg = 'No system has yet been discovered. Please see https://github.com/jishi/node-sonos-http-api/issues/77 if it doesn\'t resolve itself in a few seconds.';
      logger.error(msg);
      this.sendResponse(res, 500, { status: 'error', error: msg });
      return;
    }

    const params = req.url.substring(1).split('/');
    let player: any;
    try {
      player = this.discovery.getPlayer(decodeURIComponent(params[0]));
    } catch (error: any) {
      logger.error(`Unable to parse supplied URI component (${params[0]})`, error);
      this.sendResponse(res, 500, { status: 'error', error: error.message });
      return;
    }

    const opt: any = {};
    if (player) {
      opt.action = (params[1] || '').toLowerCase();
      opt.values = params.splice(2);
    } else {
      player = this.discovery.getAnyPlayer();
      opt.action = (params[0] || '').toLowerCase();
      opt.values = params.splice(1);
    }

    opt.player = player;
    Promise.resolve()
      .then(() => this.handleAction(opt))
      .then((response: any) => {
        if (!response || response.constructor.name === 'IncomingMessage') {
          response = { status: 'success' };
        } else if (Array.isArray(response) && response.length > 0 && response[0].constructor.name === 'IncomingMessage') {
          response = { status: 'success' };
        }
        this.sendResponse(res, 200, response);
      })
      .catch((error: any) => {
        logger.error(error);
        const message = error && (error.message || error.error) ? (error.message || error.error) : 'Unknown error';
        this.sendResponse(res, error.statusCode || 500, { status: 'error', error: message });
      });
  }

  private sendResponse(res: any, code: number, body: any): void {
    const jsonResponse = JSON.stringify(body);
    res.statusCode = code;
    res.setHeader('Content-Length', Buffer.byteLength(jsonResponse));
    res.setHeader('Content-Type', 'application/json;charset=utf-8');
    res.write(Buffer.from(jsonResponse));
    res.end();
  }

  private handleAction(options: any): Promise<any> | any {
    const action = this.actions[options.action];
    if (!action) {
      return Promise.reject({ error: `action '${options.action}' not found` });
    }
    return action(options.player, options.values);
  }

  private invokeWebhook(type: string, data: any): void {
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
      body
    }).catch(() => {
      logger.error('Could not reach the configured webhook endpoint. Verify that the receiving end is up and running.');
    });
  }
}

export = HttpAPI;
