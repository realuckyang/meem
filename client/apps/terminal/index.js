// 终端能力(pty)· 把 ws 依赖换成注入的 emit
//   emit(frame) · frame = { type, to:'web', data }  → 经 client ws 发出 → DO 穿透转发给 Meem 控制台
//   handle(message) · 处理 Meem 控制台发来的 terminal.* / data.* / system.* 帧

import pty from 'node-pty';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 30;
const terminals = new Map();
let activeId = null;
let emit = () => {};

export function setEmit(fn) { emit = fn; }

function broadcast(type, data) { emit({ type, to: 'web', data }); }

function genId() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getDefaultShell() {
  return os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
}
function getDefaultDirectory() {
  const desktop = path.join(os.homedir(), 'Desktop');
  return fs.existsSync(desktop) ? desktop : os.homedir();
}
function ensureDirectory(cwd) {
  const target = cwd && String(cwd).trim() ? String(cwd).trim() : getDefaultDirectory();
  const resolved = path.resolve(target);
  const st = fs.statSync(resolved);
  if (!st.isDirectory()) throw new Error('启动目录不是文件夹');
  return resolved;
}
function ensureHelperExecutable() {
  if (process.platform !== 'darwin') return;
  try {
    const root = path.resolve(path.dirname(require.resolve('node-pty')), '..');
    const helper = path.join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
    if (!fs.existsSync(helper)) return;
    const mode = fs.statSync(helper).mode;
    if ((mode & 0o111) === 0) fs.chmodSync(helper, mode | 0o755);
  } catch { /* */ }
}

function meta(t) {
  return { id: t.id, title: t.title, cwd: t.cwd, cols: t.cols, rows: t.rows, createdAt: t.createdAt, isActive: t.id === activeId };
}
function list() { return [...terminals.values()].map(meta); }
function get(id) {
  if (id && terminals.has(id)) return terminals.get(id);
  if (activeId && terminals.has(activeId)) return terminals.get(activeId);
  return terminals.values().next().value || null;
}
function broadcastList() { broadcast('terminal.list', { terminals: list(), activeTerminalId: activeId }); }
function broadcastInit(t) { broadcast('system.init', { terminalId: t.id, cols: t.cols, rows: t.rows }); }

function attach(t, p) {
  t.ptyProcess = p;
  p.onData((output) => { if (t.ptyProcess === p) broadcast('data.output', { terminalId: t.id, output }); });
  p.onExit(() => {
    if (t.ptyProcess !== p) return;
    if (!terminals.has(t.id)) return;
    closeTerm(t.id, terminals.size <= 1);
  });
}

function create(opts = {}) {
  const cwd = ensureDirectory(opts.cwd);
  const id = opts.terminalId || genId();
  if (terminals.has(id)) return terminals.get(id);
  const cols = opts.cols || DEFAULT_COLS;
  const rows = opts.rows || DEFAULT_ROWS;
  const t = { id, title: opts.title || path.basename(cwd) || 'Terminal', cwd, cols, rows, createdAt: Date.now(), ptyProcess: null };
  ensureHelperExecutable();
  attach(t, pty.spawn(getDefaultShell(), [], { name: 'xterm-color', cols, rows, cwd, env: process.env }));
  terminals.set(id, t);
  activeId = id;
  broadcast('terminal.created', { terminal: meta(t), activeTerminalId: activeId });
  broadcastInit(t);
  broadcast('terminal.activated', { terminalId: id });
  return t;
}
function activate(id) {
  const t = get(id); if (!t) return;
  activeId = t.id;
  broadcast('terminal.activated', { terminalId: t.id });
  broadcastInit(t);
}
function closeTerm(id, ensureOne) {
  const t = get(id); if (!t) return;
  terminals.delete(t.id);
  if (activeId === t.id) activeId = terminals.keys().next().value || null;
  t.ptyProcess?.kill();
  broadcast('terminal.closed', { terminalId: t.id, activeTerminalId: activeId });
  if (!terminals.size && ensureOne) { const c = create({}); broadcast('terminal.activated', { terminalId: c.id }); return; }
  if (activeId) { broadcast('terminal.activated', { terminalId: activeId }); const a = get(activeId); if (a) broadcastInit(a); }
}
function write(id, input) { const t = get(id); if (t && input) t.ptyProcess?.write(input); }
function resize(id, cols, rows) { const t = get(id); if (!t || !cols || !rows) return; t.cols = cols; t.rows = rows; t.ptyProcess?.resize(cols, rows); }
function restart(id) {
  const t = get(id); if (!t) return;
  t.ptyProcess?.kill();
  ensureHelperExecutable();
  attach(t, pty.spawn(getDefaultShell(), [], { name: 'xterm-color', cols: t.cols, rows: t.rows, cwd: t.cwd, env: process.env }));
  broadcastInit(t);
}

/** 处理 Meem 控制台发来的终端帧 */
export function handle(message) {
  const t = message.type;
  const d = message.data || {};
  try {
    switch (t) {
      case 'terminal.list': broadcastList(); return true;
      case 'terminal.create': create(d); return true;
      case 'terminal.activate': activate(d.terminalId); return true;
      case 'terminal.close': closeTerm(d.terminalId, true); return true;
      case 'data.input': write(d.terminalId, d.input); return true;
      case 'system.init':
      case 'system.resize': resize(d.terminalId, d.cols, d.rows); return true;
      case 'system.command':
        if (d.command === 'restart') restart(get(d.terminalId)?.id);
        else if (d.command === 'clear') get(d.terminalId)?.ptyProcess?.write('\x1b[2J\x1b[H');
        else if (d.command === 'ctrl_c') get(d.terminalId)?.ptyProcess?.write('\x03');
        return true;
      default: return false;
    }
  } catch (err) {
    broadcast('terminal.error', { terminalId: d.terminalId || null, error: err.message || String(err) });
    return true;
  }
}

/** 新控制台连上时推快照 */
export function snapshot() {
  broadcastList();
  const a = get();
  if (a) broadcastInit(a);
}
export function shutdown() { for (const t of terminals.values()) t.ptyProcess?.kill(); }
