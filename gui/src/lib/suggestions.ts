// 解析 AI 回复末尾的 <suggestions>[{type,text}]</suggestions> 区块。
//
// 返回：
//   - text: 去掉 suggestions 块后剩下的正文
//   - replies: type=reply 的建议数组（建议塞主对话给对方的输入框）
//   - asks:    type=ask   的建议数组（建议继续问智能体）

export interface ParsedAssistant {
  text: string;
  replies: string[];
  asks: string[];
}

const RE = /<suggestions>([\s\S]*?)<\/suggestions>/i;

export function parseAssistant(raw: string): ParsedAssistant {
  if (!raw) return { text: '', replies: [], asks: [] };
  const m = raw.match(RE);
  if (!m) return { text: raw, replies: [], asks: [] };

  const text = raw.replace(RE, '').trim();
  const replies: string[] = [];
  const asks: string[] = [];

  let arr: unknown = null;
  try { arr = JSON.parse(m[1].trim()); } catch {}
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const t = (item as any).text;
      const k = (item as any).type;
      if (typeof t !== 'string' || !t.trim()) continue;
      if (k === 'reply') replies.push(t);
      else if (k === 'ask') asks.push(t);
    }
  }

  return { text, replies, asks };
}
