// 单个 agent 的设置页：emoji / name / description / prompt / 工具勾选
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { req, type Agent, type ToolMeta } from '../../lib/api';

const KIND_LABELS: Record<string, string> = {
  function: '直接函数',
  agent:    '子智能体',
  trigger:  '异步触发器',
};

const KIND_ORDER: ToolMeta['kind'][] = ['agent', 'function', 'trigger'];

export default function AgentSettings() {
  const { aid = '' } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [registry, setRegistry] = useState<ToolMeta[]>([]);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const [a, reg] = await Promise.all([
        req<Agent>(`/api/agents/${aid}`),
        req<ToolMeta[]>('/api/registry'),
      ]);
      setAgent(a);
      setName(a.name);
      setEmoji(a.emoji);
      setDescription(a.description);
      setPrompt(a.prompt);
      setTools(new Set(a.tools ?? []));
      setRegistry(reg);
    } catch (e: any) {
      setErr(e?.message ?? '加载失败');
    }
  }

  useEffect(() => { if (aid) load(); }, [aid]);

  // 按 kind 分组工具
  const grouped = useMemo(() => {
    const g: Record<string, ToolMeta[]> = {};
    for (const t of registry) (g[t.kind] ||= []).push(t);
    return g;
  }, [registry]);

  function toggle(name: string) {
    setTools((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function save() {
    setSaving(true); setErr('');
    try {
      await req(`/api/agents/${aid}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name, emoji, description, prompt,
          tools: Array.from(tools),
        }),
      });
      navigate(`/agents/${aid}`);
    } catch (e: any) {
      setErr(e?.message ?? '保存失败');
      setSaving(false);
    }
  }

  async function remove() {
    if (!agent || agent.preset) return;
    if (!confirm(`删除「${agent.name}」？历史会话也会一并清除。`)) return;
    try {
      await req(`/api/agents/${aid}`, { method: 'DELETE' });
      navigate('/agents');
    } catch (e: any) {
      alert(e?.message ?? '删除失败');
    }
  }

  if (!agent) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
          <button onClick={() => navigate(`/agents/${aid}`)} className="text-2xl text-accent px-1 leading-none">‹</button>
          <span className="text-[17px] font-semibold flex-1">设置</span>
        </header>
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">{err || '加载中…'}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate(`/agents/${aid}`)} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1 truncate">设置 · {agent.name}</span>
        <button onClick={save} disabled={saving} className="text-accent font-medium px-2 disabled:opacity-40">
          {saving ? '…' : '保存'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-12">
        {/* 基础信息 */}
        <div className="px-4 pt-4">
          <div className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase px-1 pb-2">基础</div>
          <div className="bg-white rounded-xl overflow-hidden divide-y divide-neutral-100">
            <Field label="头像">
              <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                     className="w-12 text-center text-2xl bg-neutral-50 rounded px-2 py-1" />
            </Field>
            <Field label="名称">
              <input value={name} onChange={(e) => setName(e.target.value)}
                     className="flex-1 bg-neutral-50 rounded px-3 py-2 text-[14px]" />
            </Field>
            <Field label="简介" stack>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                        className="w-full bg-neutral-50 rounded px-3 py-2 text-[14px] resize-none" />
            </Field>
            <Field label="人设" stack>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5}
                        placeholder="告诉它它是谁、要做什么、怎么说话"
                        className="w-full bg-neutral-50 rounded px-3 py-2 text-[14px] resize-none" />
            </Field>
          </div>
        </div>

        {/* 工具勾选 */}
        <div className="px-4 pt-6">
          <div className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase px-1 pb-2">能用的工具</div>
          {KIND_ORDER.map((kind) => {
            const list = grouped[kind] ?? [];
            if (!list.length) return null;
            return (
              <div key={kind} className="mb-3">
                <div className="text-xs text-neutral-500 px-1 pb-1.5">{KIND_LABELS[kind]}</div>
                <div className="bg-white rounded-xl overflow-hidden divide-y divide-neutral-100">
                  {list.map((t) => (
                    <label key={t.name} className="flex items-start gap-3 px-3 py-2.5 active:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={tools.has(t.name)}
                        onChange={() => toggle(t.name)}
                        className="mt-1 w-4 h-4 accent-current"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{t.name}</div>
                        <div className="text-[12px] text-neutral-500 mt-0.5">{t.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {err && <div className="px-4 pt-3 text-red-500 text-sm">{err}</div>}

        {!agent.preset && (
          <div className="px-4 pt-8">
            <button onClick={remove} className="w-full h-11 rounded-xl bg-red-50 text-red-600 font-medium active:bg-red-100">
              删除这个智能体
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, stack }: { label: string; children: React.ReactNode; stack?: boolean }) {
  if (stack) {
    return (
      <div className="px-3 py-2.5">
        <div className="text-xs text-neutral-500 mb-1.5">{label}</div>
        {children}
      </div>
    );
  }
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <div className="text-xs text-neutral-500 w-12 flex-shrink-0">{label}</div>
      {children}
    </div>
  );
}
