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
  const [vision, setVision] = useState(!!me.settings.vision);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await req('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ url, key, model, vision: vision ? 1 : 0 }),
      });
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

        <div className="pt-2">
          <button
            onClick={() => setVision(!vision)}
            className="flex items-start gap-3 w-full bg-white rounded-xl px-4 py-3 text-left active:bg-neutral-50"
          >
            <div className="flex-1">
              <div className="text-[15px] flex items-center gap-2">
                <span>👁️</span>
                <span>支持视觉</span>
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                开启后，智能体才会启用截图工具。模型必须支持图片输入（gpt-4o、claude-3.5、gemini 等），否则会报错。
              </div>
            </div>
            <div className={`mt-1 w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${vision ? 'bg-accent' : 'bg-neutral-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${vision ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
