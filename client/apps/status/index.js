// 状态 + 截图 面板能力(请求/应答)· 设备监控数据采集
import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { screenshot } from '../computer/screenshot.js';

let emit = () => {};
export function setEmit(fn) { emit = fn; }

function cpuTotals() {
  const cpus = os.cpus() || [];
  let idle = 0, total = 0;
  for (const c of cpus) {
    const tm = c.times;
    idle += tm.idle;
    total += tm.user + tm.nice + tm.sys + tm.idle + tm.irq;
  }
  return { idle, total, count: cpus.length, model: cpus[0]?.model || '', speed: cpus[0]?.speed || 0 };
}

// 采样两次 CPU times,算真实占用率(loadavg/核数 不准)
async function cpuUsagePercent(sampleMs = 200) {
  const a = cpuTotals();
  await new Promise((r) => setTimeout(r, sampleMs));
  const b = cpuTotals();
  const idleDiff = b.idle - a.idle;
  const totalDiff = b.total - a.total;
  if (totalDiff <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 1000) / 10));
}

function memInfo() {
  const total = os.totalmem(), free = os.freemem(), used = total - free;
  return { total, free, used, percent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0 };
}

function netInterfaces() {
  const ifs = os.networkInterfaces() || {};
  const out = [];
  for (const [name, addrs] of Object.entries(ifs)) {
    for (const a of addrs || []) {
      if (a.internal) continue;
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      out.push({ name, address: a.address, mac: a.mac });
    }
  }
  return out;
}

// 根分区占用 · df -k /(win32 不支持,返回 null)
function diskRoot() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') return resolve(null);
    execFile('df', ['-k', '/'], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve(null);
      const lines = String(stdout).trim().split(/\n/);
      const parts = (lines[lines.length - 1] || '').split(/\s+/).filter(Boolean);
      const total = Number(parts[1]) * 1024, used = Number(parts[2]) * 1024, avail = Number(parts[3]) * 1024;
      if (!Number.isFinite(total) || total <= 0) return resolve(null);
      resolve({ mount: '/', total, used, free: avail, percent: Math.round((used / total) * 1000) / 10 });
    });
  });
}

async function snapshot(reqId) {
  const [usagePercent, disk] = await Promise.all([cpuUsagePercent(200), diskRoot()]);
  const cpus = cpuTotals();
  return {
    reqId,
    capturedAt: Date.now(),
    host: { hostname: os.hostname(), platform: os.platform(), release: os.release(), arch: os.arch(), uptime: os.uptime() },
    cpu: { count: cpus.count, model: cpus.model, speed: cpus.speed, usagePercent, loadavg: os.loadavg() },
    mem: memInfo(),
    disk,
    network: netInterfaces(),
  };
}

export async function handle(message) {
  const t = message.type; const d = message.data || {}; const reqId = d.reqId;
  try {
    if (t === 'status.get') {
      emit({ type: 'status.ok', to: 'web', data: await snapshot(reqId) });
      return true;
    }
    if (t === 'screen.shot') {
      const r = await screenshot({ format: 'png' });
      // screenshot 返回 { outputPath } · 读成 dataUrl 发给前端
      const buf = await fs.promises.readFile(r.outputPath);
      const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
      emit({ type: 'screen.ok', to: 'web', data: { reqId, dataUrl } });
      return true;
    }
    return false;
  } catch (e) {
    emit({ type: t.startsWith('screen') ? 'screen.err' : 'status.err', to: 'web', data: { reqId, error: e.message || String(e) } });
    return true;
  }
}
