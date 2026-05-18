import { useEffect, useState } from 'react';
import { req, type InboxThread, type Me } from '../api';
import Avatar from '../components/Avatar';
import { pushToast } from '../components/Toast';
import { fmtTime } from '../lib/time';
import InboxThreadView from './InboxThreadView';

export default function Inbox({
  threadId,
  processSessionId,
  onOpenThread,
  onCloseThread,
}: {
  threadId?: string;
  processSessionId?: string;
  onOpenThread: (id: string) => void;
  onCloseThread: () => void;
}) {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [address, setAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAddress, setShowAddress] = useState(false);

  const refresh = () => req<InboxThread[]>('/api/inbox/threads').then(setThreads).catch(() => {});

  useEffect(() => {
    refresh();
    req<Me>('/api/me').then((me) => setAddress(me.publicAddress)).catch(() => {});
    const onFrame = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (
        frame?.type === 'inbox-message' ||
        frame?.type === 'inbox-reply' ||
        frame?.type === 'inbox-thread-updated' ||
        frame?.type === 'inbox-thread-deleted'
      ) refresh();
    };
    window.addEventListener('meem:frame', onFrame as EventListener);
    return () => window.removeEventListener('meem:frame', onFrame as EventListener);
  }, []);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    pushToast('已复制收件地址', 'success');
    window.setTimeout(() => setCopied(false), 1200);
  }

  const visible = threads.filter((t) => t.status !== 'archived');

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 shrink-0 flex items-center px-4 border-b bg-white/85 backdrop-blur font-semibold">
        <span className="flex-1 flex items-center gap-1.5">
          <span className="text-lg leading-none">📥</span>
          <span>收件箱</span>
        </span>
        {address && (
          <button
            onClick={() => setShowAddress((value) => !value)}
            title={showAddress ? '收起收件地址' : '查看 / 分享收件地址'}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              showAddress ? 'text-neutral-900 bg-neutral-100' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1 1" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
            </svg>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {address && showAddress && (
          <section className="border-b bg-white px-4 py-3 meem-fade-enter">
            <div className="text-[11px] text-neutral-400">收件地址 · 把它分享出去就能收到消息</div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate text-[13px] text-neutral-700">
                {address}
              </div>
              <button
                onClick={copyAddress}
                className="h-7 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-[12px] text-neutral-600 hover:bg-neutral-50"
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </section>
        )}
        <section>
          {visible.length === 0 && (
            <div className="px-6 pt-10 pb-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-100 grid place-items-center text-2xl">📭</div>
              <div className="mt-3 text-sm text-neutral-500">暂无新来信</div>
              <div className="mt-1 text-[12px] text-neutral-400">
                把收件地址分享出去就能收到消息
              </div>
            </div>
          )}
          {visible.map((thread) => {
            const display = thread.contact_name || '访客';
            return (
              <button
                key={thread.id}
                onClick={() => onOpenThread(thread.id)}
                className="w-full text-left px-4 py-3 border-b bg-white hover:bg-neutral-50 flex items-center gap-3"
              >
                <Avatar seed={display} label={display} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium truncate">{display}</span>
                    <span className="text-xs text-neutral-400 ml-auto pl-2 shrink-0">
                      {fmtTime(thread.updated_at)}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-500 truncate">
                    {thread.last_message_preview || thread.title}
                  </div>
                </div>
                {thread.unread_count > 0 && (
                  <span className="text-xs bg-red-500 text-white rounded-full px-1.5 min-w-[18px] text-center font-semibold">
                    {thread.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </section>
      </div>

      {threadId && (
        <InboxThreadView
          threadId={threadId}
          processSessionId={processSessionId}
          onClose={() => {
            onCloseThread();
            refresh();
          }}
        />
      )}
    </div>
  );
}
