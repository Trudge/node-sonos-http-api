const MAX_CLIENTS = 100;
const HEARTBEAT_MS = 15000;

function HttpEventServer() {
    let clients = [];

    const removeClient = client => {
        clients = clients.filter(value => value !== client);
    };

    this.addClient = res => {
        if (clients.length >= MAX_CLIENTS) {
            res.statusCode = 503;
            res.end('Too many event subscribers');
            return;
        }
        clients.push(new HttpEventSource(res, removeClient));
    };

    this.sendEvent = event => clients.forEach(client => client.sendEvent(event));
}

function HttpEventSource(res, done) {
    this.sendEvent = event => res.write('data: ' + event + '\n\n');

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

module.exports = HttpEventServer;
