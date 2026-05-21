// 浏览器工具执行器——仅在扩展 side panel 内运行。
// 监听 socket 的 tool.call 帧，调 chrome.* 完成实际操作，回 tool.result / tool.error。

import { isExtension } from './env';
import { onFrame, sendFrame } from './socket';

interface ToolFrame {
  id: string;
  type: 'tool.call';
  name: string;
  args?: Record<string, unknown>;
}

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  async get_active_tab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('no_active_tab');
    return { id: tab.id, url: tab.url, title: tab.title, active: tab.active };
  },

  async list_tabs() {
    const tabs = await chrome.tabs.query({});
    return tabs.map((t) => ({ id: t.id, url: t.url, title: t.title, active: t.active, windowId: t.windowId }));
  },

  async navigate_active_tab(args) {
    const url = String(args?.url ?? '').trim();
    if (!url) throw new Error('url_required');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('no_active_tab');
    await chrome.tabs.update(tab.id, { url });
    return { ok: true, url };
  },

  async inspect_page() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('no_active_tab');
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        url: location.href,
        text: (document.body?.innerText ?? '').slice(0, 8000),
      }),
    });
    return res?.result ?? null;
  },
};

export function startToolExecutor() {
  if (!isExtension) return;
  onFrame((f: any) => {
    if (!f || f.type !== 'tool.call' || !f.id) return;
    const frame = f as ToolFrame;
    const fn = handlers[frame.name];
    (async () => {
      if (!fn) {
        sendFrame({ id: frame.id, type: 'tool.error', message: `unknown tool: ${frame.name}` });
        return;
      }
      try {
        const data = await fn(frame.args ?? {});
        sendFrame({ id: frame.id, type: 'tool.result', data });
      } catch (e: any) {
        sendFrame({ id: frame.id, type: 'tool.error', message: e?.message ?? String(e) });
      }
    })();
  });
}
