// 工具调用气泡——折叠态显示工具名+状态，展开后看 args/result。
// 若 result 是图片（含 url + format=png/jpeg/webp），直接渲染缩略图，点击放大。

import { useState } from 'react';

interface Props {
  name: string;
  args?: string;
  result?: string;
  size?: 'normal' | 'mini';
  defaultOpen?: boolean;
}

function pretty(text?: string): string | null {
  if (!text) return null;
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

// 从 result JSON 里探测是不是图片
function detectImage(result?: string): { url: string; format: string; bytes?: number } | null {
  if (!result) return null;
  try {
    const obj = JSON.parse(result);
    if (obj && typeof obj.url === 'string' && /^https?:\/\//.test(obj.url)) {
      const format = String(obj.format ?? '').toLowerCase();
      if (['png', 'jpeg', 'jpg', 'webp', 'gif'].includes(format)
          || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(obj.url)) {
        return { url: obj.url, format: format || 'image', bytes: obj.bytes };
      }
    }
  } catch {}
  return null;
}

function fmtBytes(n?: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ToolCard({ name, args, result, size = 'normal', defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [lightbox, setLightbox] = useState(false);
  const running = !result;
  const argsText = pretty(args);
  const resultText = pretty(result);
  const image = detectImage(result);

  const fontMain = size === 'mini' ? 'text-[11.5px]' : 'text-[12.5px]';
  const fontCode = size === 'mini' ? 'text-[11px]' : 'text-[12px]';

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1.5 px-3 py-2 bg-blue-50/50 hover:bg-blue-50 text-left"
        >
          <span className={`text-neutral-400 text-[10px] transition-transform leading-none ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="flex-shrink-0">🔧</span>
          <span className={`flex-1 truncate text-neutral-700 ${fontMain}`}>{name}</span>
          {running ? (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              运行中
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600">完成</span>
          )}
        </button>
        {open && (
          <div className="border-t border-neutral-100">
            {argsText && (
              <div>
                <div className="px-3 pt-2 pb-1 text-[10px] text-neutral-400 uppercase tracking-wider">参数</div>
                <pre className={`m-0 px-3 pb-2 ${fontCode} bg-neutral-50/60 text-neutral-700 overflow-x-auto whitespace-pre`}>{argsText}</pre>
              </div>
            )}
            {image ? (
              <div className="border-t border-neutral-100">
                <div className="px-3 pt-2 pb-1 text-[10px] text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                  <span>结果 · {image.format.toUpperCase()} {fmtBytes(image.bytes)}</span>
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    新窗口打开 ↗
                  </a>
                </div>
                <button
                  onClick={() => setLightbox(true)}
                  className="block w-full bg-neutral-900/5 hover:bg-neutral-900/10 transition-colors"
                  title="点击放大"
                >
                  <img
                    src={image.url}
                    alt={name}
                    className="block max-h-64 max-w-full mx-auto"
                    loading="lazy"
                  />
                </button>
              </div>
            ) : resultText && (
              <div className="border-t border-neutral-100">
                <div className="px-3 pt-2 pb-1 text-[10px] text-neutral-400 uppercase tracking-wider">结果</div>
                <pre className={`m-0 px-3 pb-2 ${fontCode} text-neutral-700 max-h-[240px] overflow-auto whitespace-pre-wrap break-words`}>{resultText}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox 放大查看 */}
      {lightbox && image && (
        <div
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={image.url}
            alt={name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-9 h-9 grid place-items-center text-white/80 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
