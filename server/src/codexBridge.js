import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CWD = process.env.MEEM_DEFAULT_CWD || ROOT_DIR;
const EXTERNAL_CODEX_URL = process.env.MEEM_CODEX_WS || '';
const REQUEST_TIMEOUT_MS = 120000;
const TURN_TIMEOUT_MS = 10 * 60 * 1000;

let child = null;
let socket = null;
let port = null;
let requestId = 1;
let initialized = false;
let thread = null;
let activeTurn = null;
let lastError = '';

const pending = new Map();

function enhancedPath() {
  return [
    path.join(os.homedir(), '.npm-global', 'bin'),
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    process.env.PATH || '',
  ]
    .filter(Boolean)
    .join(':');
}

function codexEnv() {
  return { ...process.env, PATH: enhancedPath() };
}

function pickPort() {
  return 19000 + Math.floor(Math.random() * 3000);
}

function appServerUrl() {
  return EXTERNAL_CODEX_URL || `ws://127.0.0.1:${port}`;
}

function status() {
  return {
    running: Boolean(EXTERNAL_CODEX_URL || (child && !child.killed)),
    managed: !EXTERNAL_CODEX_URL,
    connected: socket?.readyState === WebSocket.OPEN,
    initialized,
    port,
    url: initialized || socket ? appServerUrl() : null,
    threadId: thread?.id || null,
    cwd: thread?.cwd || DEFAULT_CWD,
    lastError,
  };
}

function rejectPending(error) {
  for (const [id, item] of pending.entries()) {
    clearTimeout(item.timer);
    pending.delete(id);
    item.reject(error);
  }
}

function sendRaw(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error('Codex app-server is not connected');
  }
  socket.send(JSON.stringify(payload));
}

function call(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
  const id = requestId++;
  sendRaw({ jsonrpc: '2.0', id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`${method} timeout`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, method, timer });
  });
}

function reply(id, result) {
  sendRaw({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  sendRaw({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleServerRequest(message) {
  const method = String(message.method || '');

  if (method === 'applyPatchApproval' || method === 'execCommandApproval') {
    reply(message.id, { decision: 'denied' });
    return true;
  }

  if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
    reply(message.id, { decision: 'decline' });
    return true;
  }

  if (method === 'item/permissions/requestApproval') {
    reply(message.id, { permissions: {}, scope: 'turn', strictAutoReview: true });
    return true;
  }

  if (method === 'item/tool/requestUserInput') {
    reply(message.id, { answers: {} });
    return true;
  }

  if (method === 'item/tool/call') {
    replyError(message.id, -32601, 'Meem dynamic tools are not implemented yet');
    return true;
  }

  return false;
}

function handleMessage(raw) {
  let message;
  try {
    message = JSON.parse(String(raw));
  } catch {
    return;
  }

  if (message.id !== undefined && message.method === undefined && pending.has(message.id)) {
    const item = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) {
      item.reject(new Error(message.error.message || JSON.stringify(message.error)));
    } else {
      item.resolve(message.result);
    }
    return;
  }

  if (message.id !== undefined && message.method !== undefined) {
    activeTurn?.({ method: 'server/request', params: message });
    if (handleServerRequest(message)) return;
  }

  if (message.method) activeTurn?.(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSocket(url) {
  for (let i = 0; i < 40; i += 1) {
    let ws = null;
    try {
      ws = new WebSocket(url);
      await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          try {
            ws.close();
          } catch {}
          reject(new Error('connect timeout'));
        }, 1000);
        ws.on('open', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        });
        ws.on('error', (err) => {
          lastError = err?.message || String(err);
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
      });

      socket = ws;
      socket.on('message', handleMessage);
      socket.on('close', () => {
        socket = null;
        initialized = false;
        thread = null;
        activeTurn = null;
        rejectPending(new Error('Codex app-server connection closed'));
      });
      socket.on('error', (err) => {
        lastError = err.message || String(err);
      });
      return;
    } catch (err) {
      lastError = err.message || String(err);
      await wait(250);
    }
  }
  throw new Error(`Could not connect to Codex app-server at ${url}`);
}

async function start() {
  if (socket?.readyState === WebSocket.OPEN && initialized) return status();

  lastError = '';

  if (!EXTERNAL_CODEX_URL && (!child || child.killed)) {
    port = pickPort();
    const url = appServerUrl();
    child = spawn('codex', ['app-server', '--listen', url], {
      env: codexEnv(),
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr?.on('data', (chunk) => {
      lastError = String(chunk).trim().slice(-2000);
    });
    child.on('error', (err) => {
      lastError = err.message || String(err);
    });
    child.on('exit', () => {
      child = null;
      socket = null;
      initialized = false;
      thread = null;
      activeTurn = null;
      rejectPending(new Error('Codex app-server exited'));
    });
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    await waitForSocket(appServerUrl());
  }

  if (!initialized) {
    await call('initialize', {
      clientInfo: { name: 'meem', title: 'Meem', version: '0.0.1' },
      capabilities: { experimentalApi: true },
    });
    sendRaw({ jsonrpc: '2.0', method: 'initialized' });
    initialized = true;
  }

  return status();
}

async function stop() {
  try {
    socket?.close();
  } catch {}
  try {
    child?.kill();
  } catch {}
  socket = null;
  child = null;
  initialized = false;
  thread = null;
  activeTurn = null;
  rejectPending(new Error('Meem Codex bridge stopped'));
  return status();
}

function normalizeThread(result, cwd) {
  if (result?.thread?.id) return result.thread;
  if (result?.id) return result;
  if (result?.threadId) return { id: result.threadId, cwd };
  return result?.thread || result || null;
}

async function createThread({
  cwd = DEFAULT_CWD,
  approvalPolicy = 'never',
  sandbox = 'workspace-write',
  baseInstructions = null,
} = {}) {
  await start();
  const result = await call('thread/start', {
    cwd,
    approvalPolicy,
    sandbox,
    baseInstructions,
    ephemeral: false,
    experimentalRawEvents: false,
    persistExtendedHistory: false,
  });
  thread = normalizeThread(result, cwd);
  return thread;
}

async function ensureThread(options = {}) {
  await start();
  const cwd = options.cwd || DEFAULT_CWD;
  if (thread?.id && thread.cwd === cwd) return thread;
  return createThread({ ...options, cwd });
}

async function listThreads({ limit = 30, cwd = '', searchTerm = '' } = {}) {
  await start();
  const params = {
    limit: Math.max(1, Math.min(100, Number(limit) || 30)),
    sortKey: 'updated_at',
    sortDirection: 'desc',
    archived: false,
    sourceKinds: ['cli', 'vscode', 'exec', 'appServer'],
    useStateDbOnly: true,
  };
  if (cwd) params.cwd = cwd;
  if (searchTerm) params.searchTerm = searchTerm;
  return call('thread/list', params);
}

async function readThread(threadId, { includeTurns = true, setCurrent = true } = {}) {
  await start();
  const result = await call('thread/read', {
    threadId: String(threadId || ''),
    includeTurns: Boolean(includeTurns),
  });
  if (setCurrent && result?.thread) thread = result.thread;
  return result;
}

function sandboxPolicyFromMode(mode) {
  if (mode === 'danger-full-access') return { type: 'dangerFullAccess' };
  if (mode === 'workspace-write') {
    return {
      type: 'workspaceWrite',
      writableRoots: [],
      networkAccess: true,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false,
    };
  }
  return { type: 'readOnly', networkAccess: false };
}

async function runTurn(
  {
    prompt,
    threadId = '',
    cwd = DEFAULT_CWD,
    approvalPolicy = 'never',
    sandbox = 'workspace-write',
  } = {},
  onEvent = () => {}
) {
  const text = String(prompt || '').trim();
  if (!text) throw new Error('prompt is required');

  await start();
  const currentThread = threadId
    ? { ...(thread || {}), id: String(threadId), cwd }
    : await ensureThread({ cwd, approvalPolicy, sandbox });
  thread = currentThread;

  // Codex 一个 turn 里可能有多段 agentMessage（被工具调用/思考事件切开），
  // 把每段 delta 缓存在 cur 里，遇到非 delta 事件时 flush，最终段间用 \n\n 拼回去。
  const segments = [];
  let cur = '';
  let turnId = null;
  let completed = false;
  const flushSegment = () => {
    if (cur) { segments.push(cur); cur = ''; }
  };
  const finalize = () => {
    flushSegment();
    return segments.join('\n\n').trim();
  };

  let handler = null;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (activeTurn === handler) activeTurn = null;
      reject(new Error('Codex turn timeout'));
    }, TURN_TIMEOUT_MS);

    handler = (message) => {
      onEvent(message);
      if (message.method === 'turn/started') {
        turnId = message.params?.turn?.id || null;
        return;
      }
      if (message.method === 'item/agentMessage/delta') {
        cur += message.params?.delta || '';
        return;
      }
      if (message.method === 'turn/completed') {
        completed = true;
        clearTimeout(timer);
        if (activeTurn === handler) activeTurn = null;
        resolve({ threadId: currentThread.id, turnId, finalText: finalize(), completed });
        return;
      }
      if (message.method === 'error') {
        clearTimeout(timer);
        if (activeTurn === handler) activeTurn = null;
        reject(new Error(message.params?.message || 'Codex error'));
        return;
      }
      // 其他事件（item completed、tool call、plan 更新等）= 段边界
      flushSegment();
    };
    activeTurn = handler;
  });

  try {
    const result = await call('turn/start', {
      threadId: currentThread.id,
      input: [{ type: 'text', text, text_elements: [] }],
      cwd,
      approvalPolicy,
      sandboxPolicy: sandboxPolicyFromMode(sandbox),
    });
    turnId = result?.turn?.id || turnId;
    onEvent({ method: 'turn/requested', params: result });
    return await done;
  } catch (err) {
    if (activeTurn === handler) activeTurn = null;
    throw err;
  }
}

function runCmd(cmd, args, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(cmd, args, { shell: false, windowsHide: true, env: codexEnv() });
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {}
    }, timeoutMs);
    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: stderr || err.message, code: -1 });
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}

async function getCliStatus() {
  const result = await runCmd('codex', ['--version']);
  return {
    installed: result.ok,
    version: result.ok ? (result.stdout.trim() || result.stderr.trim()) : '',
    error: result.ok ? '' : result.stderr || 'codex command not found',
    pathHint: enhancedPath(),
  };
}

async function getAccount() {
  const res = await runCmd('codex', ['login', 'status']);
  if (!res.ok) {
    return { available: false, loggedIn: false, method: '', error: res.stderr || 'login status failed' };
  }
  // codex 写到 stdout 或 stderr 取决于是否有 TTY
  const text = (res.stdout.trim() || res.stderr.trim());
  const loggedIn = /logged in/i.test(text) && !/not logged in/i.test(text);
  let method = '';
  const m = text.match(/using\s+(.+)$/i);
  if (m) method = m[1].trim();
  return { available: true, loggedIn, method, raw: text };
}

async function getMcpServers() {
  const res = await runCmd('codex', ['mcp', 'list']);
  if (!res.ok) {
    return { available: false, servers: [], error: res.stderr || 'mcp list failed' };
  }
  const lines = res.stdout.split('\n').filter((l) => l.trim());
  if (!lines.length) return { available: true, servers: [] };
  const servers = [];
  // first line is the header "Name  Command  Args  Env  Cwd  Status  Auth"
  for (const line of lines.slice(1)) {
    const cells = line.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    servers.push({
      name: cells[0] || '',
      command: cells[1] || '',
      status: cells[5] || '',
      auth: cells[6] || '',
    });
  }
  return { available: true, servers };
}

export default {
  status,
  start,
  stop,
  createThread,
  listThreads,
  readThread,
  runTurn,
  getCliStatus,
  getAccount,
  getMcpServers,
};
