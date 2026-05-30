// 文件能力 · 请求/应答式(reqId)
//   收 Meem 控制台的 fs.* 帧 → 操作本机 → 回 fs.X.ok / fs.X.err
//   帧形状:{ type:'fs.X.ok'|'fs.X.err', to:'web', data:{ reqId, ... } }

import fs from 'fs';
import os from 'os';
import path from 'path';

const fsp = fs.promises;
let emit = () => {};
export function setEmit(fn) { emit = fn; }

function ok(reqId, op, data = {}) { emit({ type: `${op}.ok`, to: 'web', data: { reqId, ...data } }); }
function err(reqId, op, message) { emit({ type: `${op}.err`, to: 'web', data: { reqId, error: message } }); }

async function list(reqId, dirPath, showHidden = false) {
  const target = dirPath && String(dirPath).trim() ? String(dirPath) : null;
  if (!target) return err(reqId, 'fs.list', '缺少 path');
  const entries = await fsp.readdir(target, { withFileTypes: true });
  const items = [];
  for (const e of entries) {
    if (!showHidden && e.name.startsWith('.')) continue;
    const full = path.join(target, e.name);
    let size = 0, mtime = 0;
    try { const st = await fsp.stat(full); size = st.size; mtime = st.mtimeMs; } catch { /* */ }
    items.push({ name: e.name, path: full, isDir: e.isDirectory(), size, mtime });
  }
  items.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
  ok(reqId, 'fs.list', { path: target, items });
}

async function stat(reqId, target) {
  if (!target) return err(reqId, 'fs.stat', '缺少 path');
  const st = await fsp.stat(target);
  ok(reqId, 'fs.stat', { path: target, isDir: st.isDirectory(), size: st.size, mtime: st.mtimeMs });
}

async function read(reqId, target, maxSize = 1024 * 1024) {
  if (!target) return err(reqId, 'fs.read', '缺少 path');
  const st = await fsp.stat(target);
  if (st.size > maxSize) return err(reqId, 'fs.read', `文件过大(${st.size} 字节)`);
  const text = (await fsp.readFile(target)).toString('utf8');
  ok(reqId, 'fs.read', { path: target, content: text, size: st.size });
}

async function del(reqId, target, recursive = false) {
  if (!target) return err(reqId, 'fs.delete', '缺少 path');
  await fsp.rm(target, { recursive, force: false });
  ok(reqId, 'fs.delete', { path: target });
}

async function mkdir(reqId, target) {
  if (!target) return err(reqId, 'fs.mkdir', '缺少 path');
  await fsp.mkdir(target, { recursive: true });
  ok(reqId, 'fs.mkdir', { path: target });
}

async function rename(reqId, from, to) {
  if (!from || !to) return err(reqId, 'fs.rename', '缺少 from/to');
  await fsp.rename(from, to);
  ok(reqId, 'fs.rename', { from, to });
}

export async function handle(message) {
  const t = message.type;
  const d = message.data || {};
  const reqId = d.reqId;
  try {
    switch (t) {
      case 'fs.home': ok(reqId, 'fs.home', { path: os.homedir() }); return true;
      case 'fs.list': await list(reqId, d.path, d.showHidden); return true;
      case 'fs.stat': await stat(reqId, d.path); return true;
      case 'fs.read': await read(reqId, d.path, d.maxSize); return true;
      case 'fs.delete': await del(reqId, d.path, d.recursive); return true;
      case 'fs.mkdir': await mkdir(reqId, d.path); return true;
      case 'fs.rename': await rename(reqId, d.from, d.to); return true;
      default: return false;
    }
  } catch (e) {
    err(reqId, t, e.message || String(e));
    return true;
  }
}
