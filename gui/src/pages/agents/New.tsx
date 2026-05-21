// 新建自定义智能体：起名、emoji、prompt，创建后跳到设置页让用户勾工具
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req, type Agent } from '../../lib/api';

export default function AgentNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!name.trim()) { setErr('名字必填'); return; }
    setSubmitting(true); setErr('');
    try {
      const a = await req<Agent>('/api/agents', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), emoji, description, prompt, tools: [] }),
      });
      navigate(`/agents/${a.id}/settings`, { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? '创建失败');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/agents')} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1">新建智能体</span>
        <button onClick={submit} disabled={submitting} className="text-accent font-medium px-2 disabled:opacity-40">
          {submitting ? '…' : '创建'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="bg-white rounded-xl overflow-hidden divide-y divide-neutral-100">
          <div className="px-3 py-3 flex items-center gap-3">
            <span className="text-xs text-neutral-500 w-12">头像</span>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                   className="w-14 text-center text-2xl bg-neutral-50 rounded px-2 py-1" />
          </div>
          <div className="px-3 py-3 flex items-center gap-3">
            <span className="text-xs text-neutral-500 w-12">名字</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="给它起个名字"
                   className="flex-1 bg-neutral-50 rounded px-3 py-2 text-[14px]" />
          </div>
          <div className="px-3 py-3">
            <div className="text-xs text-neutral-500 mb-1.5">简介</div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                      placeholder="一句话说它擅长什么"
                      className="w-full bg-neutral-50 rounded px-3 py-2 text-[14px] resize-none" />
          </div>
          <div className="px-3 py-3">
            <div className="text-xs text-neutral-500 mb-1.5">人设</div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6}
                      placeholder="告诉它它是谁、要做什么、怎么说话"
                      className="w-full bg-neutral-50 rounded px-3 py-2 text-[14px] resize-none" />
          </div>
        </div>
        <div className="text-xs text-neutral-400 mt-3 px-1">创建后会跳到设置页，可以勾选它能用的工具。</div>
        {err && <div className="mt-3 text-red-500 text-sm">{err}</div>}
      </div>
    </div>
  );
}
