import { useEffect, useMemo, useRef, useState } from 'react';
import type { TerminalSnippet } from '../../system/lib/api';
import { api } from '../../system/lib/api';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { cn } from '../../system/lib/utils';
import { useSelectedDevice, DeviceSelect, DeviceGuide } from '../../system/useDevices';
import AssistPanel from './AssistPanel';
import ControlStrip from './ControlStrip';
import InputBar from './InputBar';
import NewTerminalSheet from './NewTerminalSheet';
import SnippetSheet from './SnippetSheet';
import TerminalTabs from './TerminalTabs';
import { FONT_KEY, HISTORY_KEY, PANEL_KEY, RECENT_DIRS_KEY } from './constants';
import { useTerminalSessions } from './useTerminalSessions';
import { clamp, parseJson } from './utils';
import type { PanelTab } from './types';

export default function TerminalApp(_: SystemAppProps) {
  const [fontSize, setFontSize] = useState(() => clamp(Number(localStorage.getItem(FONT_KEY)) || 13, 10, 24));
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>(() => (localStorage.getItem(PANEL_KEY) === 'commands' ? 'commands' : 'keys'));
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => parseJson(localStorage.getItem(HISTORY_KEY), []));
  const [snippets, setSnippets] = useState<TerminalSnippet[]>([]);
  const [editing, setEditing] = useState<Partial<TerminalSnippet> | null>(null);
  const [snippetSheet, setSnippetSheet] = useState(false);
  const [newTerminalOpen, setNewTerminalOpen] = useState(false);
  const [recentDirs, setRecentDirs] = useState<string[]>(() => parseJson(localStorage.getItem(RECENT_DIRS_KEY), []));
  const historyIdx = useRef(history.length);
  const historyDraft = useRef('');
  const [device, setDevice, devices] = useSelectedDevice('computer');
  const online = !!devices.find((d) => d.id === device)?.online;

  const terminal = useTerminalSessions(fontSize, online, device);
  const activeTab = useMemo(() => terminal.tabs.find((tab) => tab.id === terminal.active), [terminal.tabs, terminal.active]);

  useEffect(() => { void loadSnippets(); }, []);
  useEffect(() => { localStorage.setItem(FONT_KEY, String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem(PANEL_KEY, panelTab); }, [panelTab]);
  useEffect(() => { if (terminal.active) setTimeout(() => terminal.fitTerminal(terminal.active), 40); }, [terminal.active, panelOpen]);

  async function loadSnippets() {
    const res = await api.snippets().catch(() => ({ snippets: [] }));
    setSnippets(res.snippets || []);
  }

  function sendCommand(value = input) {
    const command = value.trim();
    if (!command) return;
    terminal.sendInputRaw(command + '\r');
    const next = command === history[history.length - 1] ? history : [...history, command].slice(-50);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    historyIdx.current = next.length;
    historyDraft.current = '';
    setInput('');
  }

  function historyMove(delta: -1 | 1) {
    if (!history.length) return;
    if (delta < 0 && historyIdx.current === history.length) historyDraft.current = input;
    historyIdx.current = clamp(historyIdx.current + delta, 0, history.length);
    setInput(historyIdx.current === history.length ? historyDraft.current : history[historyIdx.current] || '');
  }

  function saveRecentDir(dir: string) {
    const next = [dir, ...recentDirs.filter((item) => item !== dir)].slice(0, 8);
    setRecentDirs(next);
    localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(next));
  }

  function createTerminal(cwd?: string) {
    const dir = cwd?.trim();
    if (dir) saveRecentDir(dir);
    terminal.createTerminal(dir);
  }

  async function saveSnippet(snippet: Partial<TerminalSnippet>) {
    const name = (snippet.name || '').trim();
    const command = (snippet.command || '').trim();
    if (!name || !command) return;
    if (snippet.id) await api.updateSnippet(snippet.id, { name, command, autoSend: snippet.autoSend !== false });
    else await api.createSnippet({ name, command, autoSend: snippet.autoSend !== false });
    setSnippetSheet(false);
    setEditing(null);
    await loadSnippets();
  }

  async function removeSnippet(id: string) {
    await api.deleteSnippet(id);
    setSnippetSheet(false);
    setEditing(null);
    await loadSnippets();
  }

  function runSnippet(snippet: TerminalSnippet) {
    if (snippet.autoSend) sendCommand(snippet.command);
    else setInput(snippet.command);
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="终端" left={devices.length ? <DeviceSelect value={device} onChange={setDevice} devices={devices} /> : undefined} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="relative flex h-full min-h-0 flex-col bg-[#111318]">
          {!online ? (
            <DeviceGuide devices={devices} selected={device} kind="computer" />
          ) : (
            <>
              <TerminalTabs tabs={terminal.tabs} active={terminal.active} onPick={terminal.activate} onClose={terminal.close} onNew={() => setNewTerminalOpen(true)} />
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {terminal.tabs.map((tab) => (
                  <div
                    key={tab.id}
                    ref={(el) => terminal.bindContainer(tab.id, el)}
                    className={cn('absolute inset-0 p-2', tab.id !== terminal.active && 'hidden')}
                  />
                ))}
                {terminal.tabs.length === 0 && <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">正在打开终端...</div>}
              </div>
              {terminal.error ? <div className="absolute right-3 top-16 rounded-md border border-red-900/60 bg-red-950 px-3 py-2 text-xs text-red-200 shadow-xl">{terminal.error}</div> : null}
              {panelOpen && (
                <AssistPanel
                  tab={panelTab}
                  setTab={setPanelTab}
                  snippets={snippets}
                  onKey={terminal.sendInputRaw}
                  onRun={runSnippet}
                  onEdit={(snippet) => { setEditing(snippet); setSnippetSheet(true); }}
                  onAdd={() => { setEditing({ name: '', command: input, autoSend: false, position: 0 }); setSnippetSheet(true); }}
                />
              )}
              <InputBar
                value={input}
                onValue={setInput}
                onSend={() => sendCommand()}
                onHistory={historyMove}
                panelOpen={panelOpen}
                togglePanel={() => setPanelOpen((value) => !value)}
                disabled={!terminal.active}
                onPaste={terminal.pasteClipboard}
              />
              <ControlStrip
                cwd={activeTab?.cwd}
                fontSize={fontSize}
                onFont={(delta) => setFontSize((value) => clamp(value + delta, 10, 24))}
                onRestart={() => terminal.command('restart')}
                onClear={() => terminal.command('clear')}
                onInterrupt={() => terminal.command('ctrl_c')}
              />
            </>
          )}
        </div>
      </div>
      <NewTerminalSheet
        open={newTerminalOpen}
        onOpenChange={setNewTerminalOpen}
        recentDirs={recentDirs}
        fsCall={terminal.fsCall}
        onCreate={(cwd) => { createTerminal(cwd); setNewTerminalOpen(false); }}
      />
      <SnippetSheet
        open={snippetSheet}
        onOpenChange={setSnippetSheet}
        snippet={editing}
        onSave={saveSnippet}
        onDelete={(id) => void removeSnippet(id)}
      />
    </main>
  );
}
