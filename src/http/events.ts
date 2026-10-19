const MAX_CLIENTS = 100;
const HEARTBEAT_MS = 15000;

class HttpEventSource {
  private res: any;

  constructor(res: any, done: (client: HttpEventSource) => void) {
    this.res = res;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, HEARTBEAT_MS);

    res.on('close', () => {
      clearInterval(heartbeat);
      done(this);
    });
  }

  sendEvent(event: string): void {
    this.res.write('data: ' + event + '\n\n');
  }
}

class HttpEventServer {
  private clients: HttpEventSource[] = [];

  addClient(res: any): void {
    if (this.clients.length >= MAX_CLIENTS) {
      res.statusCode = 503;
      res.end('Too many event subscribers');
      return;
    }
    this.clients.push(new HttpEventSource(res, (client) => this.removeClient(client)));
  }

  sendEvent(event: string): void {
    this.clients.forEach((client) => client.sendEvent(event));
  }

  private removeClient(client: HttpEventSource): void {
    this.clients = this.clients.filter((value) => value !== client);
  }
}

export = HttpEventServer;
