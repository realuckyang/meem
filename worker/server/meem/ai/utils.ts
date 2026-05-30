export function truncateToolResult(text: string, maxChars = 12000): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.7));
  const tail = text.slice(-Math.floor(maxChars * 0.2));
  return `${head}\n…[省略 ${text.length - head.length - tail.length} 字]…\n${tail}`;
}

export function asText(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}
