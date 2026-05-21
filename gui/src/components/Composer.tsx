import { useRef, useState, KeyboardEvent, CompositionEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  onAbort?: () => void;
  running?: boolean;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
}

export default function Composer({ onSend, onAbort, running, disabled, placeholder, value, onChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [composing, setComposing] = useState(false);
  const [internal, setInternal] = useState('');
  const text = value !== undefined ? value : internal;

  function setText(v: string) {
    if (onChange) onChange(v);
    else setInternal(v);
  }

  function submit() {
    const t = text.trim();
    if (!t || disabled || running) return;
    onSend(t);
    setText('');
    if (ref.current) ref.current.style.height = 'auto';
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return;
    if (composing || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.shiftKey) return;
    e.preventDefault();
    submit();
  }

  function autoResize() {
    const el = ref.current!;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  const ph = placeholder ?? (running ? '进行中… 可以中断' : '输入消息 (Enter 发送, Shift+Enter 换行)');

  return (
    <div className="flex items-end gap-2 px-3 py-2 bg-white border-t border-neutral-200 flex-shrink-0">
      <textarea
        ref={ref}
        rows={1}
        disabled={disabled || running}
        placeholder={ph}
        value={text}
        onChange={(e) => { setText(e.target.value); autoResize(); }}
        onKeyDown={onKey}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e: CompositionEvent<HTMLTextAreaElement>) => {
          setComposing(false);
          // 立即把当前值刷一次（部分浏览器 compositionend 后 value 还没同步）
          const v = (e.target as HTMLTextAreaElement).value;
          setText(v);
        }}
        className="flex-1 resize-none bg-neutral-100 rounded-2xl py-2.5 px-4 text-[15px] leading-snug max-h-40 overflow-y-auto focus:bg-white focus:shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-all disabled:opacity-60"
      />
      {running && onAbort ? (
        <button
          onClick={onAbort}
          className="w-9 h-9 grid place-items-center bg-red-500 text-white rounded-full flex-shrink-0 active:opacity-85"
          title="中断"
        >
          ■
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={disabled || running || !text.trim()}
          className="w-9 h-9 grid place-items-center bg-accent text-white rounded-full flex-shrink-0 active:opacity-85 disabled:opacity-30"
          title="发送"
        >
          ↑
        </button>
      )}
    </div>
  );
}
