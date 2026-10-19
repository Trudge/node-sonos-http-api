import http = require('http');
import https = require('https');
import fs = require('fs');
import crypto = require('crypto');
import type { IncomingMessage, ServerResponse } from 'http';

const auth = require('basic-auth');
const SonosSystem = require('sonos-discovery');
const logger = require('sonos-discovery/lib/helpers/logger');
const SonosHttpAPI = require('./http/router');
const serveStatic = require('serve-static');
const settings = require('./settings');

const serve = serveStatic(settings.webroot);
const discovery = new SonosSystem(settings);
const api = new SonosHttpAPI(discovery, settings);

const AUTH_WINDOW_MS = 60 * 1000;
const AUTH_MAX_FAILURES = 10;
const failedAuth = new Map<string, { first: number; count: number }>();

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress || 'unknown';
}

function secureEqual(left: string, right: string): boolean {
  const a = crypto.createHash('sha256').update(String(left)).digest();
  const b = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}

function checkAuth(req: IncomingMessage): boolean {
  if (!settings.auth) return true;
  const credentials = auth(req);
  if (!credentials) return false;
  return secureEqual(credentials.name, settings.auth.username)
    && secureEqual(credentials.pass, settings.auth.password);
}

function rateLimited(req: IncomingMessage): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = failedAuth.get(ip);
  if (!entry || now - entry.first > AUTH_WINDOW_MS) {
    failedAuth.set(ip, { first: now, count: 0 });
    return false;
  }
  return entry.count >= AUTH_MAX_FAILURES;
}

function recordFailure(req: IncomingMessage): void {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = failedAuth.get(ip);
  if (!entry || now - entry.first > AUTH_WINDOW_MS) {
    failedAuth.set(ip, { first: now, count: 1 });
  } else {
    entry.count += 1;
  }
}

function resetFailures(req: IncomingMessage): void {
  failedAuth.delete(clientIp(req));
}

function allowedOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (!origin || !settings.cors) return null;
  const allowed = Array.isArray(settings.cors) ? settings.cors : [settings.cors];
  if (allowed.includes('*')) return '*';
  return allowed.includes(origin) ? origin : null;
}

function setSecurityHeaders(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
  );
  if ((req.socket as any).encrypted) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = allowedOrigin(req);
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

function requestHandler(req: IncomingMessage, res: ServerResponse): void {
  setSecurityHeaders(req, res);
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.end('Method not allowed');
    return;
  }

  if (settings.auth) {
    if (rateLimited(req)) {
      res.statusCode = 429;
      res.setHeader('Retry-After', '60');
      res.end('Too many authentication failures');
      return;
    }
    if (!checkAuth(req)) {
      recordFailure(req);
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="Access Denied"');
      res.end('Access denied');
      return;
    }
    resetFailures(req);
  }

  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.end();
    return;
  }

  serve(req, res, (err?: any) => {
    if (err) {
      logger.error(err);
      res.statusCode = 500;
      res.end('Internal server error');
      return;
    }
    api.requestHandler(req, res);
  });
}

if (settings.https) {
  const options: https.ServerOptions = {};
  if (settings.https.pfx) {
    options.pfx = fs.readFileSync(settings.https.pfx);
    options.passphrase = settings.https.passphrase;
  } else if (settings.https.key && settings.https.cert) {
    options.key = fs.readFileSync(settings.https.key);
    options.cert = fs.readFileSync(settings.https.cert);
  } else {
    logger.error('Insufficient configuration for https');
    process.exit(1);
  }

  const secureServer = https.createServer({ maxHeaderSize: 16384, ...options }, requestHandler);
  secureServer.headersTimeout = 10000;
  secureServer.requestTimeout = 15000;
  secureServer.keepAliveTimeout = 5000;
  secureServer.listen(settings.securePort, () => {
    logger.info('https server listening on port', settings.securePort);
  });
}

const server = http.createServer({ maxHeaderSize: 16384 }, requestHandler);
server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.keepAliveTimeout = 5000;

process.on('unhandledRejection', (err) => {
  logger.error(err);
});

const host = settings.ip;
server.listen(settings.port, host, () => {
  logger.info('http server listening on', host, 'port', settings.port);
});

server.on('error', (err: any) => {
  if (err.code && err.code === 'EADDRINUSE') {
    logger.error(`Port ${settings.port} seems to be in use already. Make sure the sonos-http-api isn't
    already running, or that no other server uses that port. You can specify an alternative http port
    with property "port" in settings.json`);
  } else {
    logger.error(err);
  }
  process.exit(1);
});
