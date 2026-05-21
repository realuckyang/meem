// 浏览器工具的纯实现层——只依赖 chrome.* API。
// side panel / background service worker 都可以 import 来跑工具。

type Handler = (args: Record<string, any>) => Promise<unknown>;

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('no_active_tab');
  return tab;
}

function pickTab(tabs: chrome.tabs.Tab[], tabId?: number): chrome.tabs.Tab {
  if (tabId !== undefined) {
    const t = tabs.find((x) => x.id === tabId);
    if (!t) throw new Error(`tab_not_found: ${tabId}`);
    return t;
  }
  const active = tabs.find((x) => x.active && x.windowId);
  if (!active) throw new Error('no_active_tab');
  return active;
}

function tabSlim(t: chrome.tabs.Tab) {
  return {
    id: t.id,
    url: t.url,
    title: t.title,
    active: t.active,
    pinned: t.pinned,
    status: t.status,
    windowId: t.windowId,
    index: t.index,
  };
}

export const toolHandlers: Record<string, Handler> = {
  async browser_status() {
    const all = await chrome.tabs.query({});
    const active = await getActiveTab().catch(() => null);
    return {
      bridge: 'background',
      ready: true,
      tabsTotal: all.length,
      active: active ? tabSlim(active) : null,
      extensionId: chrome.runtime.id,
      version: chrome.runtime.getManifest().version,
    };
  },

  async browser_open_tab(args) {
    const url = String(args?.url ?? '').trim();
    if (!url) throw new Error('url_required');
    const tab = await chrome.tabs.create({
      url,
      active: !!args?.active,
      ...(typeof args?.windowId === 'number' ? { windowId: args.windowId } : {}),
    });
    return tabSlim(tab);
  },

  async browser_tabs(args) {
    const q: chrome.tabs.QueryInfo = {};
    if (typeof args?.currentWindow === 'boolean') q.currentWindow = args.currentWindow;
    if (typeof args?.active === 'boolean')        q.active = args.active;
    if (typeof args?.windowId === 'number')       q.windowId = args.windowId;
    const tabs = await chrome.tabs.query(q);
    return tabs.map(tabSlim);
  },

  async browser_activate_tab(args) {
    const tabId = Number(args?.tabId);
    if (!Number.isFinite(tabId)) throw new Error('tabId_required');
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab?.windowId) {
      try { await chrome.windows.update(tab.windowId, { focused: true }); } catch {}
    }
    return tab ? tabSlim(tab) : { ok: true };
  },

  async browser_close_tab(args) {
    const tabId = Number(args?.tabId);
    if (!Number.isFinite(tabId)) throw new Error('tabId_required');
    await chrome.tabs.remove(tabId);
    return { ok: true, tabId };
  },

  async browser_navigate(args) {
    const url = String(args?.url ?? '').trim();
    if (!url) throw new Error('url_required');
    let tabId: number;
    if (typeof args?.tabId === 'number') tabId = args.tabId;
    else {
      const tab = await getActiveTab();
      if (!tab.id) throw new Error('no_active_tab');
      tabId = tab.id;
    }
    const tab = await chrome.tabs.update(tabId, { url });
    return tab ? tabSlim(tab) : { ok: true, tabId };
  },

  async browser_evaluate(args) {
    const code = String(args?.code ?? '').trim();
    if (!code) throw new Error('code_required');
    let tabId: number;
    if (typeof args?.tabId === 'number') tabId = args.tabId;
    else {
      const tab = await getActiveTab();
      if (!tab.id) throw new Error('no_active_tab');
      tabId = tab.id;
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (src: string) => {
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('return (async () => { ' + src + ' })()');
          return Promise.resolve(fn()).then(
            (value) => ({ ok: true, value }),
            (e) => ({ ok: false, error: e?.message ?? String(e) }),
          );
        } catch (e: any) {
          return { ok: false, error: e?.message ?? String(e) };
        }
      },
      args: [code],
    });
    return res?.result ?? null;
  },

  async browser_screenshot(args) {
    let tabId: number;
    let windowId: number | undefined;
    if (typeof args?.tabId === 'number') {
      tabId = args.tabId;
      const all = await chrome.tabs.query({});
      windowId = pickTab(all, tabId).windowId;
    } else {
      const tab = await getActiveTab();
      tabId = tab.id!;
      windowId = tab.windowId;
    }
    const format = args?.format === 'jpeg' ? 'jpeg' : 'png';
    const quality = typeof args?.quality === 'number' ? args.quality : undefined;
    const dataUrl = await chrome.tabs.captureVisibleTab(
      windowId!,
      { format, ...(quality !== undefined ? { quality } : {}) },
    );
    return { tabId, format, bytes: dataUrl.length, dataUrl };
  },
};

export async function runTool(name: string, args: Record<string, any>): Promise<unknown> {
  const fn = toolHandlers[name];
  if (!fn) throw new Error(`unknown tool: ${name}`);
  return fn(args ?? {});
}
