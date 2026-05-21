import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req } from '../../lib/api';
import { useMe } from '../../lib/me';
import SubHeader from '../../components/SubHeader';

export default function Persona() {
  const navigate = useNavigate();
  const { me, refresh } = useMe();
  const [prompt, setPrompt] = useState(me.settings.prompt);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await req('/api/settings', { method: 'PATCH', body: JSON.stringify({ prompt }) });
      await refresh();
      navigate('/me');
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="人设" onSave={save} saving={saving} />
      <div className="p-4 space-y-3">
        <p className="text-sm text-neutral-400 px-1">告诉智能体你是谁、它该怎么代表你</p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：我是产品经理小张，性格直接、注重效率…"
          rows={8}
          className="input textarea"
        />
      </div>
    </div>
  );
}
