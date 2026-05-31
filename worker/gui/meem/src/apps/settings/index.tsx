import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Moon, Save, Sun } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { api } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { Input } from '../../system/ui/input';
import { cn } from '../../system/lib/utils';
import { applyTheme, getTheme, type Theme } from '../../system/theme';

interface Form { llm_url: string; llm_key: string; llm_model: string; max_rounds: string; persona: string; }

export default function SettingsApp(_: SystemAppProps) {
  const [form, setForm] = useState<Form>({ llm_url: '', llm_key: '', llm_model: '', max_rounds: '', persona: '' });
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.settings().then((s: any) => setForm({
      llm_url: s.llm_url || '',
      llm_key: s.llm_key || '',
      llm_model: s.llm_model || '',
      max_rounds: s.max_rounds != null ? String(s.max_rounds) : '',
      persona: s.persona || '',
    })).catch(() => {});
  }, []);

  function set<K extends keyof Form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true);
    try {
      await api.saveSettings({
        llm_url: form.llm_url.trim(),
        llm_key: form.llm_key.trim(),
        llm_model: form.llm_model.trim(),
        max_rounds: Number(form.max_rounds) || undefined,
        persona: form.persona,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setBusy(false);
    }
  }

  function pickTheme(t: Theme) { setTheme(t); applyTheme(t); }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="设置" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-5 p-5">
          {/* 外观主题 */}
          <section className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold tracking-wide text-foreground">外观主题</h2>
            <p className="mt-1 text-xs text-muted-foreground">在暗夜霓虹和明亮白昼之间切换,即时生效。</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ThemeCard active={theme === 'dark'} onClick={() => pickTheme('dark')} icon={<Moon />} label="暗夜" desc="霓虹赛博" />
              <ThemeCard active={theme === 'light'} onClick={() => pickTheme('light')} icon={<Sun />} label="明亮" desc="清爽白昼" />
            </div>
          </section>

          {/* 模型配置 */}
          <section className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold tracking-wide text-foreground">模型配置</h2>
            <p className="mt-1 text-xs text-muted-foreground">OpenAI 兼容接口。保存到这里后立即生效,无需改 wrangler.jsonc 或重新部署。</p>
            <div className="mt-4 space-y-3">
              <Field label="接口地址 · LLM URL">
                <Input value={form.llm_url} placeholder="https://api.deepseek.com/chat/completions" onChange={(e) => set('llm_url', e.target.value)} />
              </Field>
              <Field label="API Key">
                <Input type="password" autoComplete="off" value={form.llm_key} placeholder="sk-..." onChange={(e) => set('llm_key', e.target.value)} />
              </Field>
              <Field label="模型 · Model">
                <Input value={form.llm_model} placeholder="deepseek-v4-flash" onChange={(e) => set('llm_model', e.target.value)} />
              </Field>
              <Field label="最大轮次 · Max Rounds">
                <Input type="number" min={1} value={form.max_rounds} placeholder="100" onChange={(e) => set('max_rounds', e.target.value)} />
              </Field>
              <Field label="人设 / System 追加(可选)">
                <textarea
                  value={form.persona}
                  onChange={(e) => set('persona', e.target.value)}
                  rows={3}
                  placeholder="例如:回答尽量简洁,中文优先…"
                  className="w-full resize-none rounded-lg border border-input bg-card/50 px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-cyan focus-visible:shadow-glow-sm"
                />
              </Field>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Button onClick={save} disabled={busy}>{saved ? <Check /> : <Save />}{saved ? '已保存' : busy ? '保存中' : '保存'}</Button>
              {saved && <span className="text-xs text-lime">已生效,直接去聊天试试</span>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ThemeCard({ active, onClick, icon, label, desc }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-left transition-all hover:border-cyan/60',
        active && 'border-cyan bg-cyan/[0.06] shadow-glow-sm',
        '[&_svg]:size-5',
      )}
    >
      <span className={cn('grid size-9 place-items-center rounded-lg border border-border text-muted-foreground', active && 'border-cyan text-cyan')}>{icon}</span>
      <span className="min-w-0">
        <span className={cn('block text-sm font-semibold', active ? 'text-cyan' : 'text-foreground')}>{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      {active && <Check className="ml-auto size-4 text-cyan" />}
    </button>
  );
}
