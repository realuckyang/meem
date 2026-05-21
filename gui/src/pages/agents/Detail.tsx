// 某个智能体的详情页：顶部 hero + 会话列表 + 设置入口
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { req, type Agent, type Session } from '../../lib/api';
import { fmtRelTime } from '../../lib/fmtTime';

export default function AgentDetail() {
  const { aid = '' } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  async function load() {
    try {
      const [a, ss] = await Promise.all([
        req<Agent>(`/api/agents/${aid}`),
        req<Session[]>(`/api/sessions?agent_id=${encodeURIComponent(aid)}`),
      ]);
      setAgent(a);
      setSessions(ss);
    } catch {}
  }

  useEffect(() => { if (aid) load(); }, [aid]);

  function newSession() {
    navigate(`/sessions/new?agent=${encodeURIComponent(aid)}`);
  }

  if (!agent) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
          <button onClick={() => navigate('/agents')} className="text-2xl text-accent px-1 leading-none">‹</button>
          <span className="text-[17px] font-semibold flex-1">智能体</span>
        </header>
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">加载中…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/agents')} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1 truncate">{agent.name}</span>
        <button onClick={() => navigate(`/agents/${aid}/settings`)} className="text-accent text-[15px] px-2">设置</button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* hero */}
        <div className="bg-white px-4 py-5 border-b border-neutral-200 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-3xl flex-shrink-0">
            {agent.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">{agent.name}</div>
            <div className="text-sm text-neutral-500 mt-1">{agent.description || '—'}</div>
          </div>
        </div>

        {/* 新建会话按钮 */}
        <div className="px-3 pt-3">
          <button
            onClick={newSession}
            className="w-full h-11 rounded-xl bg-accent text-white font-medium active:opacity-90"
          >
            ＋ 新建会话
          </button>
        </div>

        {/* 历史会话 */}
        <div className="pt-4">
          {sessions.length === 0 && (
            <div className="py-10 text-center text-neutral-400 text-sm">还没有会话</div>
          )}
          {sessions.length > 0 && (
            <div className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase px-4 pb-2">历史会话</div>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/sessions/${s.id}`)}
              className="flex items-center gap-3 w-full px-4 py-3 bg-white border-b border-neutral-100 text-left active:bg-neutral-50"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[15px] truncate">{s.title || '新对话'}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{fmtRelTime(s.updated)}</div>
              </div>
              <span className="text-neutral-300 text-lg flex-shrink-0">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
