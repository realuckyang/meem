import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { req } from '../../lib/api';
import { useMe } from '../../lib/me';
import SubHeader from '../../components/SubHeader';

export default function Limits() {
  const navigate = useNavigate();
  const { me, refresh } = useMe();
  const [maxRounds, setMaxRounds] = useState(me.settings.max_rounds);
  const [toolMax, setToolMax] = useState(me.settings.tool_max_chars);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await req('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ max_rounds: maxRounds, tool_max_chars: toolMax }),
      });
      await refresh();
      navigate('/me');
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="上下文窗口" onSave={save} saving={saving} />
      <div className="p-4 space-y-5">
        <p className="text-sm text-neutral-400 px-1">
          这些参数控制智能体在一次回复里能跑多少轮工具循环、单次工具结果最多带回多少内容。
          数字越大越能完成复杂任务，但消耗 token 也越多。
        </p>

        <div className="space-y-2">
          <label className="text-sm text-neutral-700 px-1 font-medium flex justify-between">
            <span>最大轮数</span>
            <span className="text-accent tabular-nums">{maxRounds}</span>
          </label>
          <input
            type="range"
            min={1} max={50} step={1}
            value={maxRounds}
            onChange={(e) => setMaxRounds(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-neutral-400 px-1">智能体在一次回复里最多和 LLM 来回 N 次（含工具循环）</div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-neutral-700 px-1 font-medium flex justify-between">
            <span>工具结果最大字符</span>
            <span className="text-accent tabular-nums">{toolMax.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min={1000} max={50000} step={500}
            value={toolMax}
            onChange={(e) => setToolMax(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-neutral-400 px-1">单次工具调用返回值超出后会被截断，避免一条长结果占满上下文</div>
        </div>
      </div>
    </div>
  );
}
