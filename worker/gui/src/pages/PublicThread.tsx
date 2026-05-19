import { useEffect, useRef, useState } from 'react';
import { pub, type PublicConversation as PublicConversationType } from '../api';
import Avatar from '../components/Avatar';
import { fmtClock } from '../lib/time';

function tokenFromPath() {
  const [, head, token] = window.location.pathname.split('/');
  return head === 't' ? decodeURIComponent(token || '') : '';
}

export default function PublicConversation() {
  const token = tokenFromPath();
  const [data, setData] = useState<PublicConversationType | null>(null);
  const [error, setError] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  const refresh = () =>
    pub<PublicConversationType>(`/api/public/conversations/${encodeURIComponent(token)}`)
      .then(setData)
      .catch(() => setError('这条会话暂时不可用。'));

  useEffect(() => {
    refresh();
    let timer: number | null = null;
    const start = () => {
      stop();
      timer = window.setInterval(refresh, 5000);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    if (document.visibilityState === 'visible') start();

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [token]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [data?.messages.length]);

  return (
    <div className="h-full bg-neutral-50 flex flex-col">
      <header className="h-12 shrink-0 border-b bg-white/85 backdrop-blur px-4 flex items-center">
        <div className="font-semibold text-[15px] truncate">{data?.conversation.title || 'Meem 会话'}</div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        {error && <div className="p-10 text-center text-sm text-neutral-400">{error}</div>}
        {data && (
          <div className="divide-y divide-neutral-200">
            {data.messages.map((message) => {
              const outbound = message.direction === 'outbound';
              return (
                <div key={message.id} className="px-4 py-4 bg-white flex gap-3">
                  {outbound ? (
                    <div className="w-9 h-9 rounded-full bg-neutral-900 text-white grid place-items-center text-sm font-semibold">
                      M
                    </div>
                  ) : (
                    <Avatar
                      seed={message.sender_name || 'visitor'}
                      label={message.sender_name || '访'}
                      size={36}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{outbound ? 'Meem' : (message.sender_name || '访客')}</span>
                      <span className="ml-auto text-xs text-neutral-400">{fmtClock(message.created_at)}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-7 text-neutral-900">
                      {message.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
