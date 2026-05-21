import { useState } from 'react';
import { req } from '../../lib/api';
import { useMe } from '../../lib/me';
import SubHeader from '../../components/SubHeader';

const OPTIONS: { key: 'auto' | 'review'; label: string; desc: string }[] = [
  { key: 'auto', label: '自动回复', desc: '智能体收到消息后直接回复对方' },
  { key: 'review', label: '审批后回复', desc: '智能体生成草稿后等你确认再发出' },
];

export default function Mode() {
  const { me, refresh } = useMe();
  const [mode, setMode] = useState<'auto' | 'review'>(me.settings.mode);
  const [saving, setSaving] = useState(false);

  async function pick(v: 'auto' | 'review') {
    setMode(v);
    setSaving(true);
    try {
      await req('/api/settings', { method: 'PATCH', body: JSON.stringify({ mode: v }) });
      await refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="模式" />
      <div className="p-4">
        <div className="bg-white rounded-xl overflow-hidden">
          {OPTIONS.map((o, i) => (
            <button
              key={o.key}
              disabled={saving}
              onClick={() => pick(o.key)}
              className={`flex items-start gap-3 w-full px-4 py-4 text-left ${i < OPTIONS.length - 1 ? 'border-b border-neutral-100' : ''} active:bg-neutral-50`}
            >
              <span className="text-accent w-6 text-center flex-shrink-0 text-lg leading-snug">{mode === o.key ? '✓' : ''}</span>
              <div className="flex-1">
                <div className="text-[15px]">{o.label}</div>
                <div className="text-sm text-neutral-400 mt-0.5">{o.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
