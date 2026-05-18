import { useEffect, useState } from 'react';
import { pub, type PublicProfile as PublicProfileType } from '../api';
import Avatar from '../components/Avatar';

function handleFromPath() {
  const [, head, handle] = window.location.pathname.split('/');
  return head === 'u' ? decodeURIComponent(handle || '') : '';
}

// 把上次访客填写过的 name / address / 已有 thread token 留在本地，下次访问能恢复
const LOCAL_KEY = (handle: string) => `meem.visitor.${handle}`;
function loadVisitor(handle: string) {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY(handle)) || '{}'); } catch { return {}; }
}
function saveVisitor(handle: string, data: any) {
  try { localStorage.setItem(LOCAL_KEY(handle), JSON.stringify(data)); } catch {}
}

export default function PublicProfile() {
  const handle = handleFromPath();
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [senderName, setSenderName] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | { receiptUrl: string }>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pub<PublicProfileType>(`/api/public/profile/${encodeURIComponent(handle)}`)
      .then(setProfile)
      .catch(() => setError('这个地址暂时不可用。'));
    const cached = loadVisitor(handle);
    if (cached.senderName) setSenderName(cached.senderName);
    if (cached.senderAddress) setSenderAddress(cached.senderAddress);
  }, [handle]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await pub<{ ok: true; thread_id: string; message_id: string; receipt_url: string }>(
        '/api/public/messages',
        {
          method: 'POST',
          body: JSON.stringify({
            handle: profile.handle,
            sender_name: senderName.trim() || '访客',
            sender_address: senderAddress.trim(),
            text: text.trim(),
          }),
        },
      );
      // 记住 name + address + 最近一次 receipt
      saveVisitor(handle, {
        senderName: senderName.trim(),
        senderAddress: senderAddress.trim(),
        lastReceiptUrl: result.receipt_url,
      });
      navigator.clipboard.writeText(result.receipt_url).catch(() => {});
      setSent({ receiptUrl: result.receipt_url });
      setText('');
    } catch (err: any) {
      setError(err?.message || '发送失败');
    } finally {
      setBusy(false);
    }
  }

  function sendAnother() {
    setSent(null);
    setText('');
  }

  return (
    <div className="min-h-full bg-neutral-50 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-4">
          <Avatar
            seed={profile?.handle || handle}
            label={profile?.name || profile?.handle || handle}
            size={56}
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {profile ? (profile.name || profile.handle) : (handle || 'Meem')}
            </h1>
            {profile && (
              <p className="text-[12px] text-neutral-400 mt-0.5 truncate">
                @{profile.handle}
              </p>
            )}
          </div>
        </div>
        <p className="mb-4 text-sm leading-6 text-neutral-500">
          给这个 Meem 节点留一条消息。对方在线时会收到提醒，可能由本人回复，也可能由代理 Codex 协助处理。
        </p>

        {sent ? (
          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
            <div className="text-sm text-emerald-600">✓ 已送达</div>
            <div className="text-sm text-neutral-600">
              链接已复制。对方回复后，可以打开这个链接查看：
            </div>
            <a
              href={sent.receiptUrl}
              className="block break-all rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-[12px] text-neutral-700 hover:bg-neutral-100"
            >
              {sent.receiptUrl}
            </a>
            <div className="flex gap-2">
              <a
                href={sent.receiptUrl}
                className="flex-1 text-center rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white"
              >
                查看对话
              </a>
              <button
                onClick={sendAnother}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                再发一条
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
            <input
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              placeholder="你的名字"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white"
            />
            <input
              value={senderAddress}
              onChange={(event) => setSenderAddress(event.target.value)}
              placeholder="联系方式（邮箱、Meem 地址等，选填）"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white"
            />
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="写下你想说的事"
              rows={5}
              className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm leading-6 outline-none focus:border-neutral-900 focus:bg-white"
            />
            {error && <div className="text-sm text-red-500">{error}</div>}
            <button
              disabled={!profile || !text.trim() || busy}
              className="w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:bg-neutral-200"
            >
              {busy ? '发送中…' : '发送'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
