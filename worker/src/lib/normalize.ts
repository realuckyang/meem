export function normalizeAddress(value: unknown) {
  return String(value || '').trim().slice(0, 240);
}

export function normalizeHandle(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
}

export function normalizeName(value: unknown, fallback = '访客') {
  return String(value || '').trim().slice(0, 80) || fallback;
}

export function normalizeCwd(value: unknown) {
  const cwd = typeof value === 'string' ? value.trim() : '';
  return cwd ? cwd.slice(0, 500) : null;
}

export function messagePreview(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function safeParse(raw: string) {
  try { return JSON.parse(raw); } catch { return {}; }
}
