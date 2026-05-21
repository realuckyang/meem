import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req } from '../../lib/api';
import { useMe } from '../../lib/me';
import SubHeader from '../../components/SubHeader';

export default function Model() {
  const navigate = useNavigate();
  const { me, refresh } = useMe();
  const [url, setUrl] = useState(me.settings.url);
  const [key, setKey] = useState(me.settings.key);
  const [model, setModel] = useState(me.settings.model);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await req('/api/settings', { method: 'PATCH', body: JSON.stringify({ url, key, model }) });
      await refresh();
      navigate('/settings');
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="大模型" onSave={save} saving={saving} />
      <div className="p-4 space-y-4">
        <p className="text-sm text-neutral-400 px-1">配置保存到服务器，所有客户端同步</p>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">API URL</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.openai.com/v1/chat/completions" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">API Key</label>
          <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">模型</label>
          <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o" />
        </div>
      </div>
    </div>
  );
}
