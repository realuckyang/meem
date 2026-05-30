// 状态 + 截图 面板能力(请求/应答)
import os from 'os';
import fs from 'fs';
import { screenshot } from '../computer/screenshot.js';

let emit = () => {};
export function setEmit(fn) { emit = fn; }

function cpuPercent() {
  const load = os.loadavg()[0];
  const cores = os.cpus().length || 1;
  return Math.min(100, Math.round((load / cores) * 100));
}

export async function handle(message) {
  const t = message.type; const d = message.data || {}; const reqId = d.reqId;
  try {
    if (t === 'status.get') {
      emit({ type: 'status.ok', to: 'web', data: {
        reqId,
        platform: os.platform() + ' ' + os.arch(),
        cpu: cpuPercent(),
        memUsed: os.totalmem() - os.freemem(),
        memTotal: os.totalmem(),
        uptime: Math.floor(os.uptime()),
        load: os.loadavg(),
      } });
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
