import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req, type Conversation as ConvData, type User } from '../lib/api';
import { onFrame } from '../lib/socket';
import { useMe } from '../lib/me';
import Avatar from '../components/Avatar';

function fmtTime(ts: number) {
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function Messages() {
  const navigate = useNavigate();
  useMe(); // ensure auth
  const [list, setList] = useState<ConvData[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  const load = () => req<ConvData[]>('/api/conversations').then(setList).catch(() => {});

  useEffect(() => {
    load();
    const off = onFrame((f: any) => {
      if (f.type === 'message' || f.type === 'ws:open') load();
    });
    return off;
  }, []);

  useEffect(() => {
    if (!showNew || !search.trim()) { setUsers([]); return; }
    const t = setTimeout(() => {
      req<User[]>(`/api/users?q=${encodeURIComponent(search)}`).then(setUsers).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search, showNew]);

  async function startConversation(handle: string) {
    const { id } = await req<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ peer: handle }),
    });
    setShowNew(false);
    setSearch('');
    navigate(`/messages/${id}`);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center px-4 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <span className="text-[17px] font-semibold flex-1">消息</span>
        <button onClick={() => setShowNew(true)} className="text-2xl text-accent px-1 leading-none">＋</button>
      </header>

      <button
        onClick={() => navigate('/sessions')}
        className="flex items-center gap-3 px-4 py-3 bg-white border-b border-neutral-200 w-full active:bg-neutral-50"
      >
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-xl flex-shrink-0">⌘</div>
        <span className="flex-1 text-left font-medium">我的智能体</span>
        <span className="text-neutral-400 text-lg">›</span>
      </button>

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 && <div className="py-16 text-center text-neutral-400 text-sm">暂无消息</div>}
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/messages/${c.id}`)}
            className="flex items-center gap-3 w-full px-4 py-3 bg-white border-b border-neutral-100 text-left active:bg-neutral-50"
          >
            <Avatar handle={c.peer ?? '?'} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline gap-2">
                <span className="font-medium truncate">{c.peer ?? '会话'}</span>
                <span className="text-xs text-neutral-400 flex-shrink-0">{fmtTime(c.updated)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 mt-0.5">
                <span className="text-sm text-neutral-500 truncate">{c.preview || '…'}</span>
                {c.unread > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">{c.unread}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {showNew && (
        <div onClick={() => setShowNew(false)} className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-white rounded-t-2xl max-h-[70dvh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 font-semibold">
              <span>发起会话</span>
              <button onClick={() => setShowNew(false)} className="text-neutral-400">✕</button>
            </div>
            <div className="px-4 pb-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索用户…"
                autoFocus
                className="w-full h-10 px-3 bg-neutral-100 rounded-lg text-[15px]"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {users.map((u) => (
                <button key={u.id} onClick={() => startConversation(u.handle)} className="flex items-center gap-3 w-full px-4 py-3 text-left border-b border-neutral-100 active:bg-neutral-50">
                  <Avatar handle={u.handle} name={u.name} size={36} />
                  <div>
                    <div className="font-medium">{u.name || u.handle}</div>
                    <div className="text-xs text-neutral-400">@{u.handle}</div>
                  </div>
                </button>
              ))}
              {search && users.length === 0 && <div className="py-10 text-center text-neutral-400 text-sm">没有找到用户</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
