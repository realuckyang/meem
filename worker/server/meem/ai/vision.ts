import type { ChatMessage, ContentPart } from './types';

/** 截图等工具结果的 JSON 串里若含 data:image/ 的 dataUrl,展开成多模态 content:
 *  [{type:text, 元信息}, {type:image_url, 图片}]。
 *  仅作用于发往模型的 payload,不改落库/前端展示(那边仍是字符串,detectImage 自行渲染)。 */
export function expandImages(m: ChatMessage): ChatMessage {
  if (m.role !== 'tool' || typeof m.content !== 'string') return m;
  let o: any;
  try { o = JSON.parse(m.content); } catch { return m; }
  const url = typeof o?.dataUrl === 'string' && o.dataUrl.startsWith('data:image/') ? o.dataUrl : null;
  if (!url) return m;
  const { dataUrl, ...rest } = o;
  const parts: ContentPart[] = [
    { type: 'text', text: Object.keys(rest).length ? JSON.stringify(rest) : '(截图)' },
    { type: 'image_url', image_url: { url } },
  ];
  return { ...m, content: parts };
}

/** 落库前剥掉 base64 dataUrl,只留元信息(路径/尺寸等),避免把整张图写进 D1。
 *  返回新对象,绝不改原消息(原消息仍在内存 work 里供当轮模型读取 + 实时广播给前端展示)。 */
export function stripImage(m: ChatMessage): ChatMessage {
  if (m.role !== 'tool' || typeof m.content !== 'string') return m;
  let o: any;
  try { o = JSON.parse(m.content); } catch { return m; }
  if (typeof o?.dataUrl !== 'string' || !o.dataUrl.startsWith('data:image/')) return m;
  const { dataUrl, ...rest } = o;
  return { ...m, content: JSON.stringify(rest) };
}
