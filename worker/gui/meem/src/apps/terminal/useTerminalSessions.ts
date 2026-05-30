import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { onFrame, sendWs } from '../../system/lib/ws';
import { TERMINAL_THEME } from './constants';
import type { TerminalCommand, TerminalTab } from './types';

let reqSeq = 0;
const nextReq = () => `term_${++reqSeq}_${Date.now()}`;

export function useTerminalSessions(fontSize: number, enabled = true) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [active, setActive] = useState('');
  const [error, setError] = useState('');

  const activeRef = useRef('');
  const terms = useRef<Map<string, Terminal>>(new Map());
  const fits = useRef<Map<string, FitAddon>>(new Map());
  const containers = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingOutput = useRef<Map<string, string>>(new Map());
  const pendingFs = useRef<Map<string, (data: any) => void>>(new Map());

  activeRef.current = active;

  useEffect(() => {
    if (!enabled) {
      setTabs([]);
      setActive('');
      for (const term of terms.current.values()) term.dispose();
      terms.current.clear();
      fits.current.clear();
      containers.current.clear();
      pendingOutput.current.clear();
      return;
    }

    sendWs({ type: 'terminal.list', to: 'client', data: {} });
    const timer = setTimeout(() => { if (!activeRef.current) sendWs({ type: 'terminal.create', to: 'client', data: {} }); }, 600);

    const off = onFrame((message: any) => {
      const type = message?.type || '';
      const data = message?.data || {};
      if (type.startsWith('fs.')) {
        const callback = data.reqId && pendingFs.current.get(data.reqId);
        if (callback) { pendingFs.current.delete(data.reqId); callback({ ok: type.endsWith('.ok'), ...data }); }
        return;
      }
      if (type === 'data.output') {
        if (!data.terminalId || !data.output) return;
        const term = terms.current.get(data.terminalId);
        if (term) term.write(data.output);
        else pendingOutput.current.set(data.terminalId, (pendingOutput.current.get(data.terminalId) || '') + data.output);
      } else if (type === 'system.init') {
        if (data.terminalId) setTimeout(() => fitTerminal(data.terminalId), 40);
      } else if (type === 'terminal.list') {
        const list = data.terminals || [];
        setTabs(list);
        setActive(data.activeTerminalId || list.find((tab: TerminalTab) => tab.isActive)?.id || list[0]?.id || '');
        disposeMissing(list);
      } else if (type === 'terminal.created') {
        if (!data.terminal?.id) return;
        setTabs((prev) => [...prev.filter((item) => item.id !== data.terminal.id), data.terminal]);
        setActive(data.activeTerminalId || data.terminal.id);
      } else if (type === 'terminal.closed') {
        setTabs((prev) => prev.filter((item) => item.id !== data.terminalId));
        disposeTerminal(data.terminalId);
        setActive(data.activeTerminalId || '');
      } else if (type === 'terminal.activated') {
        setActive(data.terminalId || '');
      } else if (type === 'terminal.error') {
        setError(data.error || '终端错误');
        setTimeout(() => setError(''), 2400);
      } else if (type === 'connection.status' && message.computer) {
        sendWs({ type: 'terminal.list', to: 'client', data: {} });
      }
    });

    return () => {
      clearTimeout(timer);
      off();
      for (const term of terms.current.values()) term.dispose();
      terms.current.clear();
      fits.current.clear();
    };
  }, [enabled]);

  useEffect(() => {
    for (const [id, term] of terms.current) {
      term.options.fontSize = fontSize;
      setTimeout(() => fitTerminal(id), 30);
    }
  }, [fontSize]);

  function ensureTerminal(id: string) {
    if (!id) return null;
    const existing = terms.current.get(id);
    if (existing) return existing;

    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      scrollback: 5000,
      allowProposedApi: true,
      theme: TERMINAL_THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    try { term.loadAddon(new WebLinksAddon()); } catch { /* optional */ }
    term.onData((data) => { if (id === activeRef.current) sendInputRaw(data); });
    term.onSelectionChange(() => {
      const selected = term.getSelection();
      if (selected.trim()) navigator.clipboard?.writeText(selected).catch(() => {});
    });

    terms.current.set(id, term);
    fits.current.set(id, fit);
    const el = containers.current.get(id);
    if (el) openTerminal(id, el);
    const queued = pendingOutput.current.get(id);
    if (queued) { pendingOutput.current.delete(id); term.write(queued); }
    return term;
  }

  function openTerminal(id: string, el: HTMLDivElement) {
    const term = ensureTerminal(id);
    if (!term) return;
    if (!term.element) term.open(el);
    if (id === activeRef.current) setTimeout(() => fitTerminal(id), 30);
  }

  function bindContainer(id: string, el: HTMLDivElement | null) {
    if (!el) return;
    containers.current.set(id, el);
    openTerminal(id, el);
  }

  function fitTerminal(id = activeRef.current) {
    const term = terms.current.get(id);
    const fit = fits.current.get(id);
    const el = containers.current.get(id);
    if (!term || !fit || !el || !el.isConnected || el.offsetWidth < 160 || el.offsetHeight < 80) return;
    try {
      fit.fit();
      if (term.cols >= 20 && term.rows >= 4) sendWs({ type: 'system.resize', to: 'client', data: { terminalId: id, cols: term.cols, rows: term.rows } });
    } catch { /* */ }
  }

  function disposeTerminal(id?: string) {
    if (!id) return;
    terms.current.get(id)?.dispose();
    terms.current.delete(id);
    fits.current.delete(id);
    containers.current.delete(id);
    pendingOutput.current.delete(id);
  }

  function disposeMissing(nextTabs: TerminalTab[]) {
    const ids = new Set(nextTabs.map((tab) => tab.id));
    for (const id of terms.current.keys()) if (!ids.has(id)) disposeTerminal(id);
  }

  function sendInputRaw(value: string) {
    if (!activeRef.current || !value) return;
    sendWs({ type: 'data.input', to: 'client', data: { terminalId: activeRef.current, input: value } });
  }

  function createTerminal(cwd?: string) {
    const dir = cwd?.trim();
    sendWs({ type: 'terminal.create', to: 'client', data: { cwd: dir || undefined } });
  }

  function activate(id: string) {
    if (!id || id === activeRef.current) return;
    setActive(id);
    sendWs({ type: 'terminal.activate', to: 'client', data: { terminalId: id } });
  }

  function close(id: string) {
    sendWs({ type: 'terminal.close', to: 'client', data: { terminalId: id } });
  }

  function command(action: TerminalCommand) {
    if (!activeRef.current) return;
    if (action === 'clear') terms.current.get(activeRef.current)?.clear();
    sendWs({ type: 'system.command', to: 'client', data: { terminalId: activeRef.current, command: action } });
  }

  async function pasteClipboard() {
    const text = await navigator.clipboard?.readText().catch(() => '');
    if (text) sendInputRaw(text);
  }

  function fsCall(type: string, data: Record<string, unknown> = {}) {
    const reqId = nextReq();
    return new Promise<any>((resolve) => {
      pendingFs.current.set(reqId, resolve);
      sendWs({ type, to: 'client', data: { reqId, ...data } });
      setTimeout(() => { if (pendingFs.current.delete(reqId)) resolve({ ok: false, error: '本机没有响应' }); }, 12000);
    });
  }

  return {
    tabs,
    active,
    error,
    bindContainer,
    fitTerminal,
    sendInputRaw,
    createTerminal,
    activate,
    close,
    command,
    pasteClipboard,
    fsCall,
  };
}
