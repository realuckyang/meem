import { useEffect, useMemo, useState } from 'react';
import type { Overlay, Tab } from '../types';

export interface Route {
  tab: Tab;
  overlay: Overlay;
  sessionId?: string;
  threadId?: string;
  contactId?: string;
  handle?: string;
  /** /messages/thread/:tid/process/:sid 时的 sessionId */
  processSessionId?: string;
  /** /codex/settings/memory/m/:id 时的 memoryId */
  memoryId?: string;
}

const TABS: Tab[] = ['messages', 'contacts', 'codex'];
const AGENT_SETTINGS_OVERLAYS: Overlay[] = ['prompt', 'mode', 'client', 'codex'];

export function parseRoute(pathname: string): Route {
  const segs = pathname.split('/').filter(Boolean);
  const head = segs[0] as Tab | undefined;
  const tab = head && TABS.includes(head) ? head : 'messages';

  // ---- /messages ----
  if (tab === 'messages') {
    if (segs[1] === 'thread' && segs[2]) {
      if (segs[3] === 'process' && segs[4]) {
        return { tab, overlay: 'inboxProcess', threadId: segs[2], processSessionId: segs[4] };
      }
      return { tab, overlay: 'inboxThread', threadId: segs[2] };
    }
    return { tab, overlay: null };
  }

  // ---- /contacts ----
  if (tab === 'contacts') {
    if (segs[1] === 'new') return { tab, overlay: 'contactNew' };
    if (segs[1] === 'c' && segs[2]) {
      if (segs[3] === 'edit') return { tab, overlay: 'contactEdit', contactId: segs[2] };
      return { tab, overlay: 'contactDetail', contactId: segs[2] };
    }
    if (segs[1] === 'u' && segs[2]) {
      return { tab, overlay: 'domainUser', handle: segs[2] };
    }
    return { tab, overlay: null };
  }

  // ---- /codex ----
  if (segs[1] === 'session' && segs[2]) {
    return { tab, overlay: 'session', sessionId: segs[2] };
  }
  if (segs[1] === 'settings') {
    if (segs[2] === 'memory') {
      if (segs[3] === 'new') return { tab, overlay: 'memoryNew' };
      if (segs[3] === 'm' && segs[4]) return { tab, overlay: 'memoryEdit', memoryId: segs[4] };
      return { tab, overlay: 'memory' };
    }
    const sub = segs[2] as Overlay | undefined;
    const overlay = sub && AGENT_SETTINGS_OVERLAYS.includes(sub) ? sub : 'settings';
    return { tab, overlay };
  }
  return { tab, overlay: null };
}

export const PATH = {
  codex: () => '/codex',
  session: (id: string) => `/codex/session/${encodeURIComponent(id)}`,
  settings: () => '/codex/settings',
  settingsSub: (overlay: 'prompt' | 'mode' | 'client' | 'codex') =>
    `/codex/settings/${overlay}`,
  memoryList: () => '/codex/settings/memory',
  memoryNew: () => '/codex/settings/memory/new',
  memoryEdit: (id: string) => `/codex/settings/memory/m/${encodeURIComponent(id)}`,

  messages: () => '/messages',
  messageThread: (id: string) => `/messages/thread/${encodeURIComponent(id)}`,
  inboxProcess: (threadId: string, sessionId: string) =>
    `/messages/thread/${encodeURIComponent(threadId)}/process/${encodeURIComponent(sessionId)}`,

  contacts: () => '/contacts',
  contactNew: () => '/contacts/new',
  contactDetail: (id: string) => `/contacts/c/${encodeURIComponent(id)}`,
  contactEdit: (id: string) => `/contacts/c/${encodeURIComponent(id)}/edit`,
  domainUser: (handle: string) => `/contacts/u/${encodeURIComponent(handle)}`,
};

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search;
  if (path === current) return;
  if (opts.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [path, setPath] = useState(() => window.location.pathname || '/');
  useEffect(() => {
    const on = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return useMemo(() => parseRoute(path), [path]);
}
