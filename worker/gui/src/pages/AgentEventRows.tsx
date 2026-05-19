import type { AgentEvent } from '../api';
import OpenAIIcon from '../components/OpenAIIcon';
import { fmtClock } from '../lib/time';

const initial = (value: string) => (value || '?').slice(0, 1).toUpperCase();

export function EventRow({ event }: { event: AgentEvent }) {
  const payload = event.payload || {};
  if (event.kind === 'user_message') {
    return <ChatRow who="你" body={payload.text || ''} time={fmtClock(event.created_at)} />;
  }
  if (event.kind === 'agent_message') {
    return <ChatRow who="Codex" agent body={payload.text || ''} time={fmtClock(event.created_at)} />;
  }
  return <AuxRow event={event} />;
}

function ChatRow({ who, agent, body, time }: { who: string; agent?: boolean; body: string; time: string }) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2.5 px-4 py-3 bg-white">
      <div className="pt-0.5">
        <div className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold text-white ${
          agent ? 'bg-neutral-900' : 'bg-emerald-600'
        }`}>
          {agent ? <OpenAIIcon size={14} /> : initial(who)}
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 text-[14px] leading-[1.4]">
          <span className="font-semibold text-neutral-900 truncate">{who}</span>
          <span className="ml-auto pl-2 text-xs text-neutral-400 tabular-nums shrink-0">{time}</span>
        </div>
        <div className="mt-1.5 text-[13.5px] leading-[1.55] text-neutral-900 whitespace-pre-wrap break-words">
          {body}
        </div>
      </div>
    </div>
  );
}

export function ThinkingRow() {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2.5 px-4 py-3 bg-white">
      <div className="pt-0.5">
        <div className="w-7 h-7 rounded-full grid place-items-center text-white bg-neutral-900">
          <OpenAIIcon size={14} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 text-[14px] leading-[1.4]">
          <span className="font-semibold text-neutral-900">Codex</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1 h-[14px]">
          <span className="twain-dot" />
          <span className="twain-dot" />
          <span className="twain-dot" />
        </div>
      </div>
    </div>
  );
}

export function LivePartialRow({ live }: { live: any }) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2.5 px-4 py-3 bg-white">
      <div className="pt-0.5">
        <div className="w-7 h-7 rounded-full grid place-items-center text-white bg-neutral-900">
          <OpenAIIcon size={14} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 text-[14px] leading-[1.4]">
          <span className="font-semibold text-neutral-900">Codex</span>
          <span className="text-[10.5px] text-neutral-400">· 进行中</span>
        </div>
        <div className="mt-1.5 text-[13.5px] leading-[1.55] text-neutral-800 whitespace-pre-wrap break-words">
          {live.text || ''}
          <span className="inline-block w-1 h-3 bg-neutral-400 ml-0.5 align-text-bottom animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function AuxRow({ event }: { event: AgentEvent }) {
  const meta = kindMeta(event.kind);
  const payload = event.payload || {};
  let body: React.ReactNode = null;
  if (event.kind === 'agent_command_exec' || event.kind === 'agent_shell') {
    const command = payload?.meta?.command || payload?.text || '';
    const stdout = payload?.meta?.stdout || '';
    const exit = payload?.meta?.exit_code;
    body = (
      <div>
        <pre className="text-[11.5px] leading-[1.5] font-mono text-neutral-700 bg-neutral-100 rounded px-2 py-1 whitespace-pre-wrap break-all">
          {Array.isArray(command) ? command.join(' ') : command}
        </pre>
        {(stdout || exit !== undefined) && (
          <pre className="mt-1 text-[11px] leading-[1.5] font-mono text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-2 py-1 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
{exit !== undefined ? `[exit ${exit}]\n` : ''}{String(stdout).slice(0, 1200)}{String(stdout).length > 1200 ? '\n…(截断)' : ''}
          </pre>
        )}
      </div>
    );
  } else if (event.kind === 'agent_plan') {
    const steps = Array.isArray(payload?.plan?.steps) ? payload.plan.steps : [];
    body = (
      <ol className="text-[12px] leading-[1.55] text-neutral-700 list-decimal pl-5">
        {steps.map((step: any, index: number) => (
          <li key={index} className={step.status === 'completed' ? 'text-neutral-400 line-through' : ''}>
            {step.title || step.description || step.step || '(no title)'}
          </li>
        ))}
      </ol>
    );
  } else {
    body = (
      <div className="text-[12px] text-neutral-600 whitespace-pre-wrap break-words">
        {payload?.text || payload?.message || ''}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[28px_1fr] gap-2.5 px-4 py-2.5 bg-neutral-50">
      <div className="pt-0.5">
        <div className="w-7 h-7 rounded-full grid place-items-center text-[12px] text-neutral-500 bg-neutral-200">
          {meta.icon}
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 text-[11.5px] text-neutral-500">
          <span>{meta.label}</span>
          <span className="ml-auto tabular-nums">{fmtClock(event.created_at)}</span>
        </div>
        {body}
      </div>
    </div>
  );
}

function kindMeta(kind: string): { label: string; icon: string } {
  switch (kind) {
    case 'agent_command_exec': return { label: 'shell 命令', icon: '⌘' };
    case 'agent_shell': return { label: 'shell 命令', icon: '⌘' };
    case 'agent_tool_call': return { label: '工具', icon: '🔧' };
    case 'agent_file_change': return { label: '改文件', icon: '✎' };
    case 'agent_plan': return { label: '计划', icon: '☰' };
    case 'agent_reasoning': return { label: '思考', icon: '·' };
    case 'agent_error': return { label: '错误', icon: '!' };
    default: return { label: kind, icon: '•' };
  }
}
