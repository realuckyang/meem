// 朋友圈风格的图片九宫格
import { useState } from 'react';

export default function PostImages({ images }: { images: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!images.length) return null;

  if (images.length === 1) {
    return (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); setLightbox(images[0]); }}
          className="block rounded-md overflow-hidden bg-neutral-100 max-w-[240px]"
        >
          <img src={images[0]} alt="" className="w-full max-h-[300px] object-cover" />
        </button>
        {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      </>
    );
  }

  // 2、4 张 → 2 列；其他 → 3 列
  const cols = images.length === 2 || images.length === 4 ? 'grid-cols-2' : 'grid-cols-3';
  const tileMax = images.length === 2 || images.length === 4 ? 'max-w-[260px]' : 'max-w-[360px]';

  return (
    <>
      <div className={`grid gap-1 ${cols} ${tileMax}`}>
        {images.map((u, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setLightbox(u); }}
            className="aspect-square bg-neutral-100 rounded-md overflow-hidden"
          >
            <img src={u} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4"
    >
      <img src={url} alt="" className="max-w-full max-h-full object-contain" />
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl leading-none">✕</button>
    </div>
  );
}
