// 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期
export function fmtRelTime(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
}
