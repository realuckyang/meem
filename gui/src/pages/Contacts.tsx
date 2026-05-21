import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req, type User } from '../lib/api';
import { useMe } from '../lib/me';
import Avatar from '../components/Avatar';

export default function Contacts() {
  const navigate = useNavigate();
  const { me } = useMe();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      req<User[]>(`/api/users?q=${encodeURIComponent(search)}`).then(setUsers).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center px-4 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <span className="text-[17px] font-semibold">联系人</span>
      </header>

      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl p-3 flex items-center gap-3">
          <Avatar handle={me.handle} name={me.name} size={48} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-[15px] truncate">{me.name || me.handle}</div>
            <div className="text-xs text-neutral-400 mt-0.5">@{me.handle} · 我自己</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索其他人…"
          className="w-full h-10 px-3 bg-white rounded-lg text-[15px] border border-neutral-200 focus:border-accent transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase px-1 pb-2">所有用户</div>
        <div className="bg-white rounded-xl overflow-hidden">
          {users.map((u, i) => (
            <button
              key={u.id}
              onClick={() => navigate(`/contacts/${u.handle}`)}
              className={`flex items-center gap-3 w-full px-3 py-3 text-left active:bg-neutral-50 ${i < users.length - 1 ? 'border-b border-neutral-100' : ''}`}
            >
              <Avatar handle={u.handle} name={u.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[15px] truncate">{u.name || u.handle}</div>
                <div className="text-xs text-neutral-400 mt-0.5">@{u.handle}</div>
              </div>
              <span className="text-neutral-300 text-lg flex-shrink-0">›</span>
            </button>
          ))}
          {users.length === 0 && (
            <div className="py-10 text-center text-neutral-400 text-sm">
              {search ? '没有找到用户' : '加载中…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
