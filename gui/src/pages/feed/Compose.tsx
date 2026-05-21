import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req, type FeedPost } from '../../lib/api';
import { uploadImage } from '../../lib/upload';

export default function FeedCompose() {
  const navigate = useNavigate();
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickImages(files: FileList) {
    setUploading(true); setErr('');
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 9 - images.length)) {
        urls.push(await uploadImage(f));
      }
      setImages((arr) => [...arr, ...urls].slice(0, 9));
    } catch (e: any) {
      setErr(e?.message ?? '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!body.trim() && images.length === 0) { setErr('写点什么吧'); return; }
    setSubmitting(true);
    try {
      const p = await req<FeedPost>('/api/feed', {
        method: 'POST',
        body: JSON.stringify({ body: body.trim(), images }),
      });
      navigate(`/feed/${p.id}`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? '发送失败');
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && !uploading && (body.trim() || images.length > 0);

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/feed')} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1">发广播</span>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="text-accent text-[15px] font-semibold px-1 disabled:text-neutral-300"
        >
          {submitting ? '发送中…' : '发送'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-white">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="这一刻的想法…"
          rows={8}
          autoFocus
          className="w-full px-4 py-3 text-[15px] resize-none focus:outline-none"
        />

        {images.length > 0 && (
          <div className="px-4 pb-2 grid grid-cols-3 gap-2">
            {images.map((u, i) => (
              <div key={i} className="relative aspect-square bg-neutral-100 rounded-md overflow-hidden">
                <img src={u} className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 9 || uploading}
            className="px-3 py-2 text-sm bg-neutral-100 rounded-lg disabled:opacity-50"
          >
            🖼️ {uploading ? '上传中…' : `添加图片 (${images.length}/9)`}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { const fs = e.target.files; if (fs && fs.length) pickImages(fs); }}
          />
          {err && <span className="text-red-500 text-xs">{err}</span>}
        </div>
      </div>
    </div>
  );
}
