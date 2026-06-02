// 跨应用共享的格式化 / id 工具(原先在 status/files/terminal 各写一份)

/** 字节数 → 人类可读(B/KB/MB/GB/TB) */
export function fmtBytes(n?: number): string {
  if (!Number.isFinite(n)) return '—';
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = Math.abs(n);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
}

/** 时间戳(ms) → 相对时间;超过一周显示日期 */
export function relTime(ms?: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' 分钟前';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' 小时前';
  if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + ' 天前';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let seq = 0;
/** 单调递增的请求 id(WS 请求/应答配对用) */
export const makeReqId = (prefix = 'r') => `${prefix}_${++seq}_${Date.now()}`;
