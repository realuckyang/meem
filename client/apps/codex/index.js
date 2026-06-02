// Codex 桥:在本机起 `codex app-server`,经 JSON-RPC(行分隔 JSON,over stdio)对话。
//   传输/方法/字段严格对照官方文档 https://developers.openai.com/codex/app-server
//   收 Meem 控制台的 codex.* 帧 → 调 app-server → 回 codex.X.ok / codex.X.err
//   一轮对话的归一化事件经 codex.event 帧实时推回控制台(phase: partial|final)。
import { spawn } from 'node:child_process';
import os from 'node:os';

const DEFAULT_CWD = process.env.MEEM_DEFAULT_CWD || os.homedir();
const REQUEST_TIMEOUT_MS = 120_000;
const TURN_TIMEOUT_MS = 10 * 60 * 1000;

let emit = () => {};
export function setEmit(fn) { emit = fn; }

let child = null;
let stdoutBuf = '';
let requestId = 1;
let initialized = false;
let thread = null;
let activeTurn = null;
let lastError = '';
const pending = new Map();

function enhancedPath() {
  return [`${os.homedir()}/.npm-global/bin`, `${os.homedir()}/.local/bin`, '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].filter(Boolean).join(':');
}
const codexEnv = () => ({ ...process.env, PATH: enhancedPath() });

function status() {
  return { running: Boolean(child && !child.killed), connected: Boolean(child && !child.killed), initialized, threadId: thread?.id || null, cwd: thread?.cwd || DEFAULT_CWD, lastError };
}
function rejectPending(error) { for (const [id, item] of pending.entries()) { clearTimeout(item.timer); pending.delete(id); item.reject(error); } }

// ── 线协议:JSON-RPC 2.0,但「jsonrpc 字段在线上省略」(见文档)──
function sendRaw(payload) {
  if (!child || child.killed || !child.stdin?.writable) throw new Error('Codex app-server 未连接');
  child.stdin.write(JSON.stringify(payload) + '\n');
}
function call(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
  const id = requestId++;
  sendRaw({ id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { if (!pending.has(id)) return; pending.delete(id); reject(new Error(`${method} 超时`)); }, timeoutMs);
    pending.set(id, { resolve, reject, method, timer });
  });
}
const reply = (id, result) => sendRaw({ id, result });
const replyError = (id, code, message) => sendRaw({ id, error: { code, message } });

// 服务端反向请求(审批/输入):非交互模式自动放行
function handleServerRequest(message) {
  const m = String(message.method || '');
  if (m === 'item/commandExecution/requestApproval' || m === 'item/fileChange/requestApproval') { reply(message.id, 'accept'); return true; }
  if (m === 'item/tool/requestUserInput') { reply(message.id, { answers: {} }); return true; }
  if (m === 'item/tool/call') { replyError(message.id, -32601, '动态工具暂未实现'); return true; }
  // 兼容旧版方法名
  if (m === 'execCommandApproval' || m === 'applyPatchApproval') { reply(message.id, { decision: 'approved' }); return true; }
  return false;
}

function handleMessage(line) {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.method) console.log('[codex] <-', message.method);
  // 应答
  if (message.id !== undefined && message.method === undefined && pending.has(message.id)) {
    const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error.message || JSON.stringify(message.error)));
    else item.resolve(message.result);
    return;
  }
  // 服务端反向请求(带 id + method)
  if (message.id !== undefined && message.method !== undefined) {
    if (handleServerRequest(message)) return;
  }
  // 通知
  if (message.method) activeTurn?.(message);
}

function onStdout(chunk) {
  stdoutBuf += chunk.toString();
  let idx;
  while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
    const line = stdoutBuf.slice(0, idx).trim();
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (line) handleMessage(line);
  }
}

async function start() {
  if (child && !child.killed && initialized) return status();
  lastError = '';
  if (!child || child.killed) {
    console.log('[codex] spawn: codex app-server (stdio)');
    child = spawn('codex', ['app-server'], { env: codexEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', onStdout);
    child.stderr.on('data', (c) => { const s = String(c).trim(); lastError = s.slice(-2000); console.error('[codex] stderr:', s.slice(0, 400)); });
    child.on('error', (e) => { lastError = e.message || String(e); console.error('[codex] spawn error:', lastError, '(确认已安装 codex CLI 且在 PATH)'); });
    child.on('exit', (code) => { console.error(`[codex] app-server exited code=${code}`); child = null; initialized = false; thread = null; activeTurn = null; rejectPending(new Error('Codex app-server 退出')); });
  }
  if (!initialized) {
    await call('initialize', { clientInfo: { name: 'meem', title: 'Meem', version: '0.1.0' }, capabilities: { experimentalApi: false } });
    sendRaw({ method: 'initialized', params: {} });   // 通知,无 id
    initialized = true;
    console.log('[codex] initialized');
  }
  return status();
}

async function stop() {
  try { child?.kill(); } catch {}
  child = null; initialized = false; thread = null; activeTurn = null;
  rejectPending(new Error('Codex 桥已停止'));
  return status();
}

function normalizeThread(result, cwd) {
  if (result?.thread?.id) return result.thread;
  if (result?.id) return result;
  if (result?.threadId) return { id: result.threadId, cwd };
  return result?.thread || result || null;
}
async function createThread({ cwd = DEFAULT_CWD, approvalPolicy = 'never', sandbox = 'workspace-write' } = {}) {
  await start();
  const result = await call('thread/start', { cwd, approvalPolicy, sandbox });
  thread = normalizeThread(result, cwd);
  return thread;
}
async function ensureThread(options = {}) {
  await start();
  const cwd = options.cwd || DEFAULT_CWD;
  if (thread?.id && thread.cwd === cwd) return thread;
  return createThread({ ...options, cwd });
}
async function listThreads({ limit = 40, cwd = '', searchTerm = '' } = {}) {
  await start();
  const params = { limit: Math.max(1, Math.min(100, Number(limit) || 40)), sortKey: 'updated_at', sortDirection: 'desc', archived: false };
  if (cwd) params.cwd = cwd;
  if (searchTerm) params.searchTerm = searchTerm;
  return call('thread/list', params);
}
async function readThread(threadId) {
  await start();
  const result = await call('thread/read', { threadId: String(threadId || '') });
  if (result?.thread) thread = result.thread;
  return result;
}
function sandboxPolicyFromMode(mode) {
  if (mode === 'danger-full-access') return { type: 'dangerFullAccess' };
  if (mode === 'read-only') return { type: 'readOnly', networkAccess: false };
  return { type: 'workspaceWrite', writableRoots: [], networkAccess: true, excludeTmpdirEnvVar: false, excludeSlashTmp: false };
}

// ── codex item.type → 归一化 kind ──
function mapKind(t) {
  if (!t) return 'raw';
  const s = String(t).toLowerCase();
  if (s.startsWith('user') || /user_?message/.test(s)) return 'user_message';
  if (/reason/.test(s)) return 'reasoning';
  if (/command|shell|exec/.test(s)) return 'command_exec';
  if (/tool/.test(s)) return 'tool_call';
  if (/file/.test(s)) return 'file_change';
  if (/plan/.test(s)) return 'agent_plan';
  if (/message/.test(s)) return 'agent_message';
  return s;
}
function pickItemText(item) {
  if (!item) return '';
  if (typeof item.text === 'string') return item.text;
  if (typeof item.message === 'string') return item.message;
  if (typeof item.content === 'string') return item.content;
  if (Array.isArray(item.content)) return item.content.map((c) => (typeof c === 'string' ? c : (c?.text ?? c?.content ?? ''))).filter(Boolean).join('\n');
  if (typeof item.command === 'string') return item.command;
  if (Array.isArray(item.command)) return item.command.join(' ');
  return '';
}
function pickItemMeta(item) {
  if (!item) return undefined;
  const meta = {};
  if (item.type) meta.type = item.type;
  if (item.exitCode !== undefined) meta.exit_code = item.exitCode;
  if (item.command) meta.command = item.command;
  if (item.cwd) meta.cwd = item.cwd;
  if (item.aggregatedOutput) meta.stdout = String(item.aggregatedOutput).slice(0, 2000);   // 命令输出官方字段
  if (item.path) meta.path = item.path;
  if (Array.isArray(item.changes)) meta.path = item.changes.map((c) => c?.path).filter(Boolean).join(', ');
  return Object.keys(meta).length ? meta : undefined;
}

async function runTurn({ prompt, threadId = '', cwd = DEFAULT_CWD, approvalPolicy = 'never', sandbox = 'workspace-write' } = {}, emitEvent = () => {}) {
  const text = String(prompt || '').trim();
  if (!text) throw new Error('prompt is required');
  await start();
  const currentThread = threadId ? { ...(thread || {}), id: String(threadId), cwd } : await ensureThread({ cwd, approvalPolicy, sandbox });
  thread = currentThread;
  const tid = currentThread.id;

  emitEvent({ threadId: tid, phase: 'final', item: { id: `u_${Date.now()}`, kind: 'user_message', text } });

  const itemBuffer = new Map();
  let turnId = null;
  let handler = null;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { if (activeTurn === handler) activeTurn = null; reject(new Error('Codex turn 超时')); }, TURN_TIMEOUT_MS);
    const finish = (fn) => { clearTimeout(timer); if (activeTurn === handler) activeTurn = null; fn(); };
    handler = (message) => {
      const m = message.method || '';
      const p = message.params || {};
      if (m === 'turn/started') { turnId = p?.turn?.id || null; return; }
      if (m === 'item/started') {
        const it = p?.item; if (!it?.id) return;
        const k = mapKind(it.type); if (k === 'user_message') return;
        const t0 = pickItemText(it);
        itemBuffer.set(it.id, { kind: k, text: t0 });
        emitEvent({ threadId: tid, phase: 'partial', item: { id: it.id, kind: k, text: t0, meta: pickItemMeta(it) } });
        return;
      }
      // 文本增量(官方字段 deltaText)
      if (m === 'item/agentMessage/delta' || m === 'item/reasoning/summaryTextDelta' || m === 'item/reasoning/textDelta') {
        const id = p?.itemId; if (!id) return;
        const k = m.includes('reasoning') ? 'reasoning' : 'agent_message';
        const buf = itemBuffer.get(id) || { kind: k, text: '' };
        buf.text += p?.deltaText ?? p?.delta ?? '';
        itemBuffer.set(id, buf);
        emitEvent({ threadId: tid, phase: 'partial', item: { id, kind: buf.kind, text: buf.text } });
        return;
      }
      if (m === 'item/completed') {
        const it = p?.item; if (!it?.id) return;
        const buf = itemBuffer.get(it.id);
        const k = buf?.kind || mapKind(it.type);
        itemBuffer.delete(it.id);
        if (k === 'user_message') return;
        const t1 = pickItemText(it) || buf?.text || '';
        const meta = pickItemMeta(it);
        const hasMeta = meta && Object.keys(meta).some((x) => x !== 'type');
        if (k === 'reasoning' && !t1) return;
        if (t1 || hasMeta) emitEvent({ threadId: tid, phase: 'final', item: { id: it.id, kind: k, text: t1, meta } });
        return;
      }
      // 计划(官方:{ explanation, plan:[{step,status}] })
      if (m === 'turn/plan/updated') {
        emitEvent({ threadId: tid, phase: 'final', item: { id: `plan_${tid}`, kind: 'agent_plan', meta: { plan: { steps: p?.plan ?? [], explanation: p?.explanation } } } });
        return;
      }
      if (m === 'turn/completed') {
        for (const [id, buf] of itemBuffer.entries()) { if (buf.text) emitEvent({ threadId: tid, phase: 'final', item: { id, kind: buf.kind, text: buf.text } }); }
        itemBuffer.clear();
        const st = p?.turn?.status;
        if (st === 'failed') finish(() => reject(new Error(p?.turn?.error?.message || 'Codex turn failed')));
        else finish(() => resolve({ threadId: tid, turnId, completed: true, status: st || 'completed' }));
        return;
      }
    };
    activeTurn = handler;
  });

  try {
    const result = await call('turn/start', { threadId: tid, input: [{ type: 'text', text }], cwd, approvalPolicy, sandboxPolicy: sandboxPolicyFromMode(sandbox) });
    turnId = result?.turn?.id || turnId;
    return await done;
  } catch (e) {
    if (activeTurn === handler) activeTurn = null;
    throw e;
  }
}

// ── 帧分发(Meem client 接口)──
const ok = (type, reqId, data = {}) => emit({ type, to: 'web', data: { reqId, ...data } });
const err = (reqId, type, error) => emit({ type: `${type}.err`, to: 'web', data: { reqId, error } });

export async function handle(frame) {
  const t = frame?.type || '';
  const d = frame.data || {};
  const reqId = d.reqId;
  try {
    if (t === 'codex.status') { ok('codex.status.ok', reqId, await start().then(status).catch(() => status())); return true; }
    if (t === 'codex.threads') { const r = await listThreads({ cwd: d.cwd, searchTerm: d.q }); ok('codex.threads.ok', reqId, { threads: r?.threads ?? r?.items ?? [] }); return true; }
    if (t === 'codex.thread') { const r = await readThread(d.threadId); ok('codex.thread.ok', reqId, { thread: r?.thread ?? null, turns: r?.turns ?? r?.items ?? [] }); return true; }
    if (t === 'codex.new') { const th = await createThread({ cwd: d.cwd }); ok('codex.new.ok', reqId, { thread: th }); return true; }
    if (t === 'codex.turn') {
      const res = await runTurn({ prompt: d.prompt, threadId: d.threadId, cwd: d.cwd, sandbox: d.sandbox }, (payload) => emit({ type: 'codex.event', to: 'web', data: { reqId, ...payload } }));
      ok('codex.turn.ok', reqId, res);
      return true;
    }
    if (t === 'codex.stop') { await stop(); ok('codex.stop.ok', reqId, { ...status() }); return true; }
    return false;
  } catch (e) {
    err(reqId, t, e?.message || String(e));
    return true;
  }
}

export function shutdown() { try { stop(); } catch {} }
