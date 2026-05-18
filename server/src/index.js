import http from 'node:http';
import { meem } from './meemBridge.js';
import codex from './codexBridge.js';

const PORT = Number(process.env.MEEM_BACKEND_PORT || 9509);
const HOST = process.env.MEEM_BACKEND_HOST || '127.0.0.1';

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function sendJson(res, statusCode, data) {
  setCommonHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

async function handle(req, res) {
  setCommonHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === 'GET' && url.pathname === '/api/status') {
    sendJson(res, 200, {
      ok: true,
      meem: meem.status(),
      codex: codex.status(),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth') {
    const body = await readJson(req);
    await meem.setToken(body.token);
    sendJson(res, 200, {
      ok: true,
      meem: meem.status(),
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

await meem.init();

http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    sendJson(res, 500, { error: err?.message || String(err) });
  });
}).listen(PORT, HOST, () => {
  console.log(`Meem local server listening on http://${HOST}:${PORT}`);
});
