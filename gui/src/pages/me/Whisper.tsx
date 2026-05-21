import { useEffect, useState } from 'react';
import { req } from '../../lib/api';
import { useMe } from '../../lib/me';
import SubHeader from '../../components/SubHeader';

type WhisperMode = 'silent' | 'suggest' | 'auto';

const MODES: { key: WhisperMode; label: string; desc: string; icon: string }[] = [
  { key: 'silent',  label: '静默',         icon: '🤫', desc: '收到新消息不触发智能体，等你手动开「悄悄商量」' },
  { key: 'suggest', label: '主动建议',     icon: '💡', desc: '收到新消息时自动准备好回复草稿和分析，等你确认' },
  { key: 'auto',    label: '自动回复对方', icon: '🤖', desc: '收到新消息时直接代你回复（仅在你的人设和必读记忆允许范围内）' },
];

const PRESET: Record<Exclude<WhisperMode, 'silent'>, string> = {
  suggest: `你正在「主动建议」模式。对方给我发来一条消息，请你**不要直接回复**，而是帮我准备好选项。

工作流程：
1. 看完整聊天上下文，判断对方意图
2. 必要时 memory_search 找你过去记下的相关信息
3. 必要时用浏览器工具查事实
4. 在回复**末尾**用 <suggestions> 区块给我准备多版本草稿：
   - reply：给对方的回复（短、自然、可直接发，多版本：正式/随意/直接）
   - ask：我可能想继续问你的方向

不要代我发——只准备建议，等我点采用。`,

  auto: `你正在「自动回复对方」模式。对方给我发来一条消息，**你要直接代我回复**。

工作流程：
1. 看完整聊天上下文 + 必读记忆里我的人设、偏好、语气
2. 需要时 memory_search 我过去说过的相关事
3. 需要时浏览器工具查事实
4. 想清楚之后，**直接调用 conversation_reply 工具**把回复发出去

边界（很重要）：
- 用我的语气，自然、像我在说话
- 涉及金钱、承诺、决策、敏感话题——**不要**自动回，留给我（不调 conversation_reply 即可，我下次登录会看到你的笔记）
- 不需要在文本里复述要发什么——只通过工具发`,
};

export default function Whisper() {
  const { me, refresh } = useMe();
  const [mode, setMode] = useState<WhisperMode>(me.settings.whisper_mode);
  const [suggestPrompt, setSuggestPrompt] = useState(me.settings.whisper_suggest_prompt);
  const [autoPrompt, setAutoPrompt] = useState(me.settings.whisper_auto_prompt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(me.settings.whisper_mode);
    setSuggestPrompt(me.settings.whisper_suggest_prompt);
    setAutoPrompt(me.settings.whisper_auto_prompt);
  }, [me]);

  async function save() {
    setSaving(true);
    try {
      await req('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          whisper_mode: mode,
          whisper_suggest_prompt: suggestPrompt,
          whisper_auto_prompt: autoPrompt,
        }),
      });
      await refresh();
    } finally { setSaving(false); }
  }

  function loadPreset(target: 'suggest' | 'auto') {
    if (target === 'suggest') setSuggestPrompt(PRESET.suggest);
    else setAutoPrompt(PRESET.auto);
  }

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="悄悄商量" onSave={save} saving={saving} />
      <div className="p-4 space-y-4 overflow-y-auto">
        <p className="text-sm text-neutral-400 px-1">
          决定收到别人消息时智能体怎么介入。三档由低到高：静默 / 主动建议 / 自动回复。
        </p>

        <div className="bg-white rounded-xl overflow-hidden">
          {MODES.map((m, i) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-start gap-3 w-full px-4 py-3 text-left ${i < MODES.length - 1 ? 'border-b border-neutral-100' : ''} active:bg-neutral-50`}
            >
              <span className="text-accent w-5 text-center flex-shrink-0 text-lg leading-snug">{mode === m.key ? '✓' : ''}</span>
              <div className="flex-1">
                <div className="text-[15px] flex items-center gap-2">
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </div>
                <div className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {mode === 'silent' && (
          <div className="bg-neutral-50 rounded-xl px-4 py-3 text-[13px] text-neutral-500 leading-relaxed">
            静默模式下智能体不会自动触发，无需提示词。需要时你可以手动在某条对方消息下点「跟智能体讨论这条」。
          </div>
        )}

        {mode === 'suggest' && (
          <PromptEditor
            label="主动建议 提示词"
            hint="收到对方消息时，智能体会以这段提示词运行"
            value={suggestPrompt}
            onChange={setSuggestPrompt}
            onLoadPreset={() => loadPreset('suggest')}
          />
        )}

        {mode === 'auto' && (
          <PromptEditor
            label="自动回复 提示词"
            hint="收到对方消息时，智能体会以这段提示词运行，并被允许调用 conversation_reply 工具直接发送"
            value={autoPrompt}
            onChange={setAutoPrompt}
            onLoadPreset={() => loadPreset('auto')}
            warning="自动回复有风险：智能体会直接代你说话。务必在「人设」和「必读记忆」里把语气、边界写清楚。"
          />
        )}
      </div>
    </div>
  );
}

function PromptEditor({
  label, hint, value, onChange, onLoadPreset, warning,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onLoadPreset: () => void;
  warning?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <label className="text-sm text-neutral-700 font-medium">{label}</label>
        <button onClick={onLoadPreset} className="text-[12px] text-accent hover:underline">
          载入推荐
        </button>
      </div>
      <div className="text-xs text-neutral-400 px-1">{hint}</div>
      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[12.5px] text-amber-700 leading-relaxed">
          ⚠️ {warning}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        placeholder="点上方「载入推荐」获得默认模板"
        className="input textarea font-mono text-[12.5px] leading-relaxed"
      />
    </div>
  );
}
