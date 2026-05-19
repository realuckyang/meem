import { useEffect, useState } from 'react';
import { auth, req, type Me, type Memory, type Mode, type Presence } from '../api';
import type { Overlay } from '../types';
import { navigate, PATH } from '../lib/router';
import OpenAIIcon from '../components/OpenAIIcon';
import { Row, Section } from '../components/List';
import ClientStatus from './ClientStatus';
import CodexStatus from './CodexStatus';
import ModePicker from './ModePicker';
import PromptEditor from './PromptEditor';
import MemoryList from './MemoryList';

const MODE_LABEL: Record<Mode, string> = {
  observe: '观察',
  approval: '审批',
  managed: '托管',
};

export default function AgentSettings({
  onClose,
  onLogout,
  overlay,
}: {
  onClose: () => void;
  onLogout: () => void;
  overlay: Overlay;
}) {
  const [modeDirect, setModeDirect] = useState<Mode | null>(null);
  const [prompt, setPrompt] = useState('');
  const [presence, setPresence] = useState<Presence | null>(null);
  const [me, setMe] = useState<{ name: string; publicAddress: string } | null>(null);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);

  const reload = async () => {
    // 各件事独立加载——某一个失败不应该让其他字段卡在默认值
    const [settingsResult, presenceResult, meResult, memoriesResult] = await Promise.allSettled([
      req<{ prompt: string; mode_direct: Mode }>('/api/settings'),
      req<Presence>('/api/presence'),
      req<Me>('/api/me'),
      req<Memory[]>('/api/memories'),
    ]);
    if (settingsResult.status === 'fulfilled') {
      setModeDirect(settingsResult.value.mode_direct);
      setPrompt(settingsResult.value.prompt);
    }
    if (presenceResult.status === 'fulfilled') setPresence(presenceResult.value);
    if (meResult.status === 'fulfilled') {
      setMe({ name: meResult.value.name, publicAddress: meResult.value.publicAddress });
    }
    if (memoriesResult.status === 'fulfilled') setMemoryCount(memoriesResult.value.length);
  };

  useEffect(() => {
    reload();
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, []);

  const desktops = presence?.sessions.filter((session) => session.kind === 'desktop') ?? [];
  const clientOnline = desktops.length > 0;
  const codexOnline = desktops.some((session) =>
    session.capabilities.codex && session.capabilities.codexLoggedIn
  );
  const account = auth.account();
  const displayName = me?.name || account;

  const closeSubpage = () => {
    navigate(PATH.settings());
    reload();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-neutral-600 text-lg">‹</button>
        <div className="font-medium text-[15px]">Codex 设置</div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <section className="p-4">
          <div className="rounded-2xl bg-white border border-neutral-200 p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-neutral-900 text-white flex items-center justify-center">
              <OpenAIIcon size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{displayName}</div>
              <div className="text-xs text-neutral-400 mt-1 truncate">@{account}</div>
              {me?.publicAddress && (
                <div className="text-[11px] text-neutral-400 mt-0.5 truncate">{me.publicAddress}</div>
              )}
            </div>
          </div>
        </section>

        <Section title="状态">
          <Row icon="🔌" label="连接器"
               value={clientOnline ? '已连接' : '未连接'}
               onClick={() => navigate(PATH.settingsSub('client'))} />
          <Row icon="🧠" label="Codex"
               value={codexOnline ? '已就绪' : '未就绪'}
               onClick={() => navigate(PATH.settingsSub('codex'))} last />
        </Section>

        <Section title="代理">
          <Row icon="🪪" label="人设"
               value={prompt ? `${prompt.length} 字` : '未配置'}
               onClick={() => navigate(PATH.settingsSub('prompt'))} />
          <Row icon="🧠" label="记忆"
               value={memoryCount === null ? '加载中…' : `${memoryCount} 条`}
               onClick={() => navigate(PATH.memoryList())} />
          <Row icon="⚙️" label="模式"
               value={modeDirect ? MODE_LABEL[modeDirect] : '加载中…'}
               onClick={() => navigate(PATH.settingsSub('mode'))} last />
        </Section>

        <div className="px-4 pb-8 pt-2">
          <button
            onClick={() => { auth.clear(); onLogout(); }}
            className="w-full bg-white border border-neutral-200 rounded-xl py-3 text-red-500 font-medium hover:bg-red-50/40"
          >
            退出登录
          </button>
        </div>
      </div>

      {overlay === 'prompt' && <PromptEditor current={prompt} onClose={closeSubpage} />}
      {overlay === 'mode' && modeDirect && (
        <ModePicker
          current={modeDirect}
          onClose={closeSubpage}
          onSaved={(next) => {
            setModeDirect(next);
            closeSubpage();
          }}
        />
      )}
      {overlay === 'client' && <ClientStatus onClose={closeSubpage} />}
      {overlay === 'codex' && <CodexStatus onClose={closeSubpage} />}
      {(overlay === 'memory' || overlay === 'memoryNew' || overlay === 'memoryEdit') && (
        <MemoryList onClose={closeSubpage} />
      )}
    </div>
  );
}
