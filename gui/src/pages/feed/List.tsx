import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req, type FeedPost, type Me } from '../../lib/api';
import { useMe } from '../../lib/me';
import { uploadImage } from '../../lib/upload';
import { fmtRelTime } from '../../lib/fmtTime';
import Avatar from '../../components/Avatar';
import PostImages from './Images';

const DEFAULT_COVER_GRADIENT = 'linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)';

export default function Feed() {
  const navigate = useNavigate();
  const { me, refresh } = useMe();
  const [items, setItems] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverBusy, setCoverBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await req<{ items: FeedPost[] }>('/api/feed?limit=30');
      setItems(r.items);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changeCover(f: File) {
    setCoverBusy(true);
    try {
      const url = await uploadImage(f);
      await req<Me>('/api/me', { method: 'PATCH', body: JSON.stringify({ cover: url }) });
      await refresh();
    } catch (e: any) {
      alert(e?.message ?? '上传失败');
    } finally {
      setCoverBusy(false);
    }
  }

  async function toggleLike(p: FeedPost) {
    try {
      const r = await req<{ liked: boolean; likes: number }>('/api/feed/like', {
        method: 'POST',
        body: JSON.stringify({ target_kind: 'post', target: p.id }),
      });
      setItems((arr) => arr.map((x) => x.id === p.id ? { ...x, liked: r.liked, likes: r.likes } : x));
    } catch {}
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center px-4 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <span className="text-[17px] font-semibold flex-1">广播</span>
        <button onClick={() => navigate('/feed/new')} className="text-2xl text-accent px-1 leading-none">＋</button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 封面 + 个人信息 */}
        <button
          onClick={() => coverInput.current?.click()}
          className="relative w-full h-44 block overflow-hidden group"
          style={me.cover ? { backgroundImage: `url(${me.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: DEFAULT_COVER_GRADIENT }}
          title="点击更换封面"
        >
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) changeCover(f); }}
          />
          <div className="absolute top-2 right-2 text-[11px] text-white/80 bg-black/30 px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            {coverBusy ? '上传中…' : '更换封面'}
          </div>
          <div className="absolute bottom-3 right-4 flex items-end gap-3">
            <div className="text-right">
              <div className="text-white font-semibold text-[16px] drop-shadow">{me.name || me.handle}</div>
              <div className="text-white/80 text-xs drop-shadow">@{me.handle}</div>
            </div>
            <div className="ring-2 ring-white rounded-full">
              <Avatar handle={me.handle} name={me.name} size={56} />
            </div>
          </div>
        </button>

        {/* 列表 */}
        {loading && <div className="py-12 text-center text-neutral-400 text-sm">加载中…</div>}
        {!loading && items.length === 0 && (
          <div className="py-16 text-center text-neutral-400 text-sm">还没有广播，点 ＋ 发一条</div>
        )}
        {items.map((p) => (
          <article
            key={p.id}
            onClick={() => navigate(`/feed/${p.id}`)}
            className="bg-white px-4 py-4 border-b border-neutral-100 cursor-pointer active:bg-neutral-50"
          >
            <div className="flex items-start gap-3">
              <Avatar handle={p.author} size={40} />
              <div className="min-w-0 flex-1">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${p.author}`); }}
                  className="text-[14px] font-semibold text-accent"
                >
                  {p.author}
                </button>
                <div className="mt-1 text-[15px] text-neutral-800 whitespace-pre-wrap break-words">{p.body}</div>
                {p.images.length > 0 && (
                  <div className="mt-2"><PostImages images={p.images} /></div>
                )}
                <div className="flex items-center gap-3 mt-2 text-[12px] text-neutral-400">
                  <span>{fmtRelTime(p.created)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(p); }}
                    className={`flex items-center gap-1 ${p.liked ? 'text-red-500' : ''}`}
                  >
                    {p.liked ? '♥' : '♡'} {p.likes || ''}
                  </button>
                  <span className="flex items-center gap-1">💬 {p.replies || ''}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
