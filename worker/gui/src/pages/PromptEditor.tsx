import { useState } from 'react';
import { req } from '../api';
import { pushToast } from '../components/Toast';

export default function PromptEditor({ current, onClose }: { current: string; onClose: () => void }) {
  const [body, setBody] = useState(current);
  const [saving, setSaving] = useState(false);
  const dirty = body !== current;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await req('/api/settings', { method: 'PUT', body: JSON.stringify({ prompt: body }) });
      pushToast('已保存', 'success');
      onClose();
    } catch {} finally { setSaving(false); }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-neutral-600 text-lg">‹</button>
        <div className="font-medium text-[15px]">人设</div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="text-sm text-neutral-900 disabled:text-neutral-300 px-1"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </header>
      <div className="flex-1 p-3">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="描述你希望 AI 分身的语气、原则、知识背景……"
          className="w-full h-full resize-none rounded-2xl border border-neutral-200 bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-neutral-400"
        />
      </div>
      <div className="px-4 pb-3 text-xs text-neutral-400">
        {body.length} 字 · 这段文本会作为 AGENTS.md 的人设层注入。
      </div>
    </div>
  );
}
