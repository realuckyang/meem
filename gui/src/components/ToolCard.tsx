// 工具调用气泡——折叠态显示工具名+状态，展开后看 args/result。
// AIOS 风格：左侧 chevron，bg 浅蓝条，下方两段 pre 块。

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

export default function ToolCard({ name, args, result, size = 'normal', defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const running = !result;
  const argsText = pretty(args);
  const resultText = pretty(result);

  const fontMain = size === 'mini' ? 'text-[11.5px]' : 'text-[12.5px]';
  const fontCode = size === 'mini' ? 'text-[11px]' : 'text-[12px]';

  return (
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
          {resultText && (
            <div className="border-t border-neutral-100">
              <div className="px-3 pt-2 pb-1 text-[10px] text-neutral-400 uppercase tracking-wider">结果</div>
              <pre className={`m-0 px-3 pb-2 ${fontCode} text-neutral-700 max-h-[240px] overflow-auto whitespace-pre-wrap break-words`}>{resultText}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
