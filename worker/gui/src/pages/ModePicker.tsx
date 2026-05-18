import { useState } from 'react';
import { req, type Mode } from '../api';
import { pushToast } from '../components/Toast';

const MODES: { key: Mode; label: string; desc: string; hint?: string }[] = [
  {
    key: 'observe',
    label: '观察',
    desc: '只读机器、不写文件不跑命令',
    hint: '收到的来信只生成草稿，等你点「采用」才发出',
  },
  {
    key: 'approval',
    label: '审批',
    desc: '能写文件 / 跑命令，但关键动作需要确认',
    hint: '收到的来信同样只生成草稿，待你审批后发',
  },
  {
    key: 'managed',
    label: '托管',
    desc: '机器全权处理，完成后向你汇报',
    hint: '收到的来信会被 Codex 直接回复给对方',
  },
];

export default function ModePicker({
  current,
  onClose,
  onSaved,
}: {
  current: Mode;
  onClose: () => void;
  onSaved: (mode: Mode) => void;
}) {
  const [selected, setSelected] = useState<Mode>(current);
  const [saving, setSaving] = useState(false);
  const dirty = selected !== current;

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      await req('/api/settings', { method: 'PUT', body: JSON.stringify({ mode_direct: selected }) });
      pushToast('已保存', 'success');
      onSaved(selected);
    } catch {} finally { setSaving(false); }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-neutral-600 text-lg">‹</button>
        <div className="font-medium text-[15px]">模式</div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="text-sm text-neutral-900 disabled:text-neutral-300 px-1"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </header>
      <div className="p-4 space-y-3">
        {MODES.map((mode) => {
          const isSelected = selected === mode.key;
          return (
            <button
              key={mode.key}
              onClick={() => setSelected(mode.key)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                isSelected
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                  : 'bg-white border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{mode.label}</span>
                {isSelected && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/15">当前</span>
                )}
              </div>
              <div className={`text-sm mt-1.5 ${isSelected ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {mode.desc}
              </div>
              {mode.hint && (
                <div className={`text-[12px] mt-1.5 ${isSelected ? 'text-neutral-400' : 'text-neutral-400'}`}>
                  · {mode.hint}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
