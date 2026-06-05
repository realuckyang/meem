export function joinPath(base: string, name: string, sep: string) {
  if (!base) return name;
  if (sep === '\\') return `${base.replace(/[\\]+$/, '')}\\${name}`;
  return `${base.replace(/\/+$/, '')}/${name}`;
}

export function parseJson<T>(raw: string | null, fallback: T): T {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
