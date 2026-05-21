import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req, type Session as SessionData } from '../../lib/api';

const STATUS: Record<string, { label: string; color: string }> = {
  thinking: { label: '处理中', color: 'bg-amber-50 text-amber-600' },
  approval: { label: '待审批', color: 'bg-amber-100 text-amber-700' },
  input: { label: '等待输入', color: 'bg-neutral-100 text-neutral-600' },
  done: { label: '完成', color: 'bg-emerald-50 text-emerald-600' },
  cancelled: { label: '已取消', color: 'bg-neutral-100 text-neutral-500' },
  error: { label: '出错', color: 'bg-red-50 text-red-600' },
};

export default function Sessions() {
  const navigate = useNavigate();
  const [list, setList] = useState<SessionData[]>([]);

  const load = () => req<SessionData[]>('/api/sessions?kind=direct').then(setList).catch(() => {});

  useEffect(() => { load(); }, []);

  function create() {
    navigate('/sessions/new');
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/messages')} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1">智能体</span>
        <button onClick={create} className="text-2xl text-accent px-1 leading-none">＋</button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 && <div className="py-16 text-center text-neutral-400 text-sm">暂无对话，点 + 新建</div>}
        {list.map((s) => {
          const st = STATUS[s.status] ?? { label: s.status, color: 'bg-neutral-100 text-neutral-500' };
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/sessions/${s.id}`)}
              className="flex items-center gap-3 w-full px-4 py-3 bg-white border-b border-neutral-100 text-left active:bg-neutral-50"
            >
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-lg flex-shrink-0">⌘</div>
              <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                <span className="truncate">{s.title || '对话'}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${st.color}`}>{st.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
