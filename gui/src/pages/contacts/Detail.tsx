import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { req, type User } from '../../lib/api';
import { usePresence } from '../../lib/presence';
import Avatar from '../../components/Avatar';
import { AvatarPresence } from '../../components/PresenceDot';

export default function UserDetail() {
  const { handle = '' } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const handles = useMemo(() => (handle ? [handle] : []), [handle]);
  const presence = usePresence(handles);
  const status = presence[handle];

  useEffect(() => {
    if (!handle) return;
    req<User>(`/api/users/${encodeURIComponent(handle)}`)
      .then(setUser)
      .catch(() => setUser(null));
  }, [handle]);

  async function chat() {
    if (!user) return;
    const { id } = await req<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ peer: user.handle }),
    });
    navigate(`/messages/${id}`);
  }

  if (!user) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
          <button onClick={() => navigate('/contacts')} className="text-2xl text-accent px-1 leading-none">‹</button>
          <span className="text-[17px] font-semibold flex-1">资料</span>
        </header>
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">加载中…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/contacts')} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1">资料</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center pt-10 pb-6 px-6 bg-white border-b border-neutral-200">
          <div className="relative">
            <Avatar handle={user.handle} name={user.name} size={88} />
            <AvatarPresence status={status} size={16} />
          </div>
          <div className="mt-4 text-[22px] font-semibold">{user.name || user.handle}</div>
          <div className="text-sm text-neutral-400 mt-1">@{user.handle}</div>
          {status?.online && (
            <div className={`mt-2 text-xs flex items-center gap-1.5 ${(status.extension || status.extensionBg) ? 'text-emerald-600' : 'text-amber-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${(status.extension || status.extensionBg) ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              {(status.extension || status.extensionBg) ? '浏览器在线' : '浏览器离线'}
            </div>
          )}
          {user.bio && (
            <div className="mt-4 text-[14px] text-neutral-600 leading-relaxed text-center whitespace-pre-wrap max-w-[360px]">
              {user.bio}
            </div>
          )}
        </div>

        <div className="px-4 pt-6">
          <div className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase px-1 pb-2">基本信息</div>
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="flex items-center px-4 py-3 border-b border-neutral-100">
              <span className="text-lg w-6 text-center flex-shrink-0">🪪</span>
              <span className="ml-3 text-[15px] flex-1">账号</span>
              <span className="text-sm text-neutral-400">@{user.handle}</span>
            </div>
            <div className="flex items-center px-4 py-3">
              <span className="text-lg w-6 text-center flex-shrink-0">👤</span>
              <span className="ml-3 text-[15px] flex-1">昵称</span>
              <span className="text-sm text-neutral-400">{user.name || '未设置'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border-t border-neutral-200 flex-shrink-0">
        <button onClick={chat} className="btn-primary flex items-center justify-center gap-2">
          <span>💬</span>
          <span>发消息</span>
        </button>
      </div>
    </div>
  );
}
