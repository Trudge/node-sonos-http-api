import type { ServerResponse } from 'node:http';

const MAX_CLIENTS = 100;
const HEARTBEAT_MS = 15000;

class HttpEventSource {
  private res: ServerResponse;
  private closed = false;

  constructor(res: ServerResponse, done: (client: HttpEventSource) => void) {
    this.res = res;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const heartbeat = setInterval(() => {
      if (!this.closed) {
        res.write(': keep-alive\n\n');
      }
    }, HEARTBEAT_MS);

    const close = () => {
      if (this.closed) return;
      this.closed = true;
      clearInterval(heartbeat);
      done(this);
    };

    res.on('close', close);
    res.on('error', close);
  }

  sendEvent(event: string): void {
    if (this.closed || this.res.writableEnded) return;
    this.res.write(`data: ${event}\n\n`);
  }
}

class HttpEventServer {
  private clients: HttpEventSource[] = [];

  addClient(res: ServerResponse): void {
    if (this.clients.length >= MAX_CLIENTS) {
      res.statusCode = 503;
      res.end('Too many event subscribers');
      return;
    }
    this.clients.push(new HttpEventSource(res, (client) => this.removeClient(client)));
  }

  sendEvent(event: string): void {
    this.clients.forEach((client) => { client.sendEvent(event); });
  }

  private removeClient(client: HttpEventSource): void {
    this.clients = this.clients.filter((value) => value !== client);
  }
}

export = HttpEventServer;
