// 容错 JSON.parse:解析失败返回 null,不抛错。
// label 仅在 debug 时打日志区分用。
export const parseJson = (raw, _label = 'json') => {
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(String(raw)) } catch { return null }
}
