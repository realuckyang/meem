export function asText(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}
