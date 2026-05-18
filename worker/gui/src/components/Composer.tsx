import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxHeight?: number;
  live?: boolean;
  onStop?: () => void;
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  maxHeight = 140,
  live,
  onStop,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const height = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${height}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, maxHeight]);

  // 进行中时：输入框锁住、键盘不发送、按钮变停止
  const locked = Boolean(live || disabled);
  const canSend = Boolean(value.trim()) && !locked;
  const shownPlaceholder = live ? '进行中…' : placeholder;

  return (
    <div className="shrink-0 border-t bg-white px-2.5 py-2 flex items-end gap-1.5">
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          const native = event.nativeEvent as any;
          const composing = native?.isComposing || event.keyCode === 229;
          if (event.key === 'Enter' && !event.shiftKey && !composing) {
            event.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        placeholder={shownPlaceholder}
        rows={1}
        disabled={locked}
        className="flex-1 resize-none border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[13.5px] leading-5 min-h-[32px] outline-none focus:border-neutral-900 focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed"
      />
      {live && onStop ? (
        <button
          onClick={onStop}
          title="停止"
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-neutral-900 text-white hover:bg-neutral-700"
        >
          <span className="w-2.5 h-2.5 bg-white rounded-[1px]" />
        </button>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!canSend}
          className={`w-8 h-8 rounded-md text-sm flex items-center justify-center shrink-0 ${
            canSend ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'
          }`}
        >
          ⇧
        </button>
      )}
    </div>
  );
}
