import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req, type Agent } from '../../lib/api';
import { fmtRelTime } from '../../lib/fmtTime';

export default function AgentsList() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const list = await req<Agent[]>('/api/agents');
      setAgents(list);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center px-4 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <span className="text-[17px] font-semibold flex-1">智能体</span>
        <button onClick={() => navigate('/agents/new')} className="text-2xl text-accent px-1 leading-none">＋</button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="py-16 text-center text-neutral-400 text-sm">加载中…</div>}
        {!loading && agents.length === 0 && (
          <div className="py-16 text-center text-neutral-400 text-sm">还没有智能体</div>
        )}
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(`/agents/${a.id}`)}
            className="flex items-center gap-3 w-full px-4 py-3.5 bg-white border-b border-neutral-100 text-left active:bg-neutral-50"
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-2xl flex-shrink-0">
              {a.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[15px] truncate">{a.name}</span>
                {a.preset && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 flex-shrink-0">预置</span>
                )}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5 truncate">{a.description || '—'}</div>
              <div className="text-[11px] text-neutral-300 mt-0.5">最近 {fmtRelTime(a.updated)}</div>
            </div>
            <span className="text-neutral-300 text-lg flex-shrink-0">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
