import http from 'node:http';
import { summarizeCommand } from './queue.js';

function isLoopback(address) {
  return address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1';
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function createBridgeHttpServer({ config, state, queue, snapshot }) {
  let server = null;

  async function handle(req, res) {
    if (req.method === 'OPTIONS') {
      json(res, 204, {});
      return;
    }

    if (!isLoopback(req.socket.remoteAddress)) {
      json(res, 403, { ok: false, error: 'Loopback only.' });
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || `${config.host}:${config.port}`}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, bridge: 'browser', ...snapshot() });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/state') {
      json(res, 200, { ok: true, ...snapshot() });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/commands/next') {
      const command = queue.claimNextCommand();
      json(res, 200, {
        ok: true,
        command: command ? summarizeCommand(command) : null,
        payload: command?.payload || null,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/commands') {
      const body = await readJson(req);
      const type = String(body?.type || '').trim();
      if (!type) {
        json(res, 400, { ok: false, error: 'Missing command type.' });
        return;
      }

      const command = queue.createCommand(type, body?.payload || {});
      json(res, 200, { ok: true, command: summarizeCommand(command) });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/commands/')) {
      const id = url.pathname.slice('/commands/'.length);
      const command = queue.findCommand(id);
      if (!command) {
        json(res, 404, { ok: false, error: 'Command not found.' });
        return;
      }
      json(res, 200, { ok: true, command: summarizeCommand(command) });
      return;
    }

    if (req.method === 'POST' && url.pathname.startsWith('/commands/') && url.pathname.endsWith('/result')) {
      const id = url.pathname.slice('/commands/'.length, -'/result'.length);
      const body = await readJson(req);
      const command = queue.completeCommand(id, body);
      if (!command) {
        json(res, 404, { ok: false, error: 'Command not found.' });
        return;
      }
      json(res, 200, { ok: true, command: summarizeCommand(command) });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/extension/register') {
      const body = await readJson(req);
      state.extension = {
        id: body.id || null,
        version: body.version || null,
        name: body.name || null,
      };
      state.lastRegisterAt = new Date().toISOString();
      state.lastHeartbeatAt = state.lastRegisterAt;
      json(res, 200, { ok: true, serverId: state.serverId });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/extension/heartbeat') {
      const body = await readJson(req);
      state.lastHeartbeatAt = new Date().toISOString();
      if (body?.tab) {
        state.extension = {
          ...(state.extension || {}),
          lastTab: body.tab,
        };
      }
      json(res, 200, { ok: true, serverId: state.serverId });
      return;
    }

    json(res, 404, { ok: false, error: 'Not found.' });
  }

  function start() {
    if (server) return Promise.resolve(snapshot());

    state.startedAt = new Date().toISOString();
    server = http.createServer((req, res) => {
      handle(req, res).catch((error) => {
        json(res, 500, { ok: false, error: error.message || String(error) });
      });
    });

    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => {
        server.off('error', reject);
        resolve(snapshot());
      });
    });
  }

  function stop() {
    if (!server) return Promise.resolve(snapshot());

    const current = server;
    server = null;
    return new Promise((resolve, reject) => {
      current.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(snapshot());
      });
    });
  }

  return {
    start,
    stop,
  };
}

export { createBridgeHttpServer };
