import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req } from '../../lib/api';
import { useMe } from '../../lib/me';
import SubHeader from '../../components/SubHeader';

export default function Profile() {
  const navigate = useNavigate();
  const { me, refresh } = useMe();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await req('/api/me', { method: 'PATCH', body: JSON.stringify({ name, bio }) });
      await refresh();
      navigate('/me');
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="个人资料" onSave={save} saving={saving} />
      <div className="p-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">账号</label>
          <input className="input" value={me.handle} disabled />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">昵称</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="显示名称" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">描述</label>
          <textarea
            className="input textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="一句话简介，会显示在你的资料页和给别人的卡片上"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
