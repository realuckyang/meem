// Notion 风格的消息行：左侧小头像，右侧 headline + body。
//
// 不用气泡 / 不用 bg 区分 mine vs theirs——行身份靠 who/action 文字表达。

import { ReactNode } from 'react';

interface Props {
  avatar: ReactNode;
  who: string;
  action?: string;
  time?: string;
  children: ReactNode;
  size?: 'normal' | 'mini';
  muted?: boolean;
}

export default function MessageRow({ avatar, who, action, time, children, size = 'normal', muted }: Props) {
  const cols = size === 'mini' ? 'grid-cols-[20px_1fr] gap-2 px-4 py-1.5' : 'grid-cols-[28px_1fr] gap-2.5 px-4 py-3';
  const whoSize = size === 'mini' ? 'text-[12px]' : 'text-[13.5px]';
  const bodySize = size === 'mini' ? 'text-[12.5px] leading-[1.55]' : 'text-[14px] leading-[1.6]';
  const bodyColor = muted ? 'text-neutral-500' : 'text-neutral-900';

  return (
    <div className={`grid ${cols} bg-white`}>
      <div className={size === 'mini' ? 'pt-[3px]' : 'pt-0.5'}>{avatar}</div>
      <div className="min-w-0">
        <div className={`flex items-baseline gap-1.5 ${whoSize}`}>
          <span className="font-semibold text-neutral-900 truncate">{who}</span>
          {action && <span className="text-neutral-400 font-normal truncate">{action}</span>}
          {time && <span className="ml-auto pl-2 text-[11px] text-neutral-400 tabular-nums shrink-0">{time}</span>}
        </div>
        <div className={`mt-1 ${bodySize} ${bodyColor} break-words`}>
          {children}
        </div>
      </div>
    </div>
  );
}

// 头像变体 1：小圆形带文字（"我"、首字母）
export function CircleLabel({ label, size = 28, bg = '#37352f' }: { label: string; size?: number; bg?: string }) {
  return (
    <div
      className="rounded-full grid place-items-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
    >
      {label}
    </div>
  );
}

// 头像变体 2：分身/Agent
export function AgentAv({ size = 20 }: { size?: number }) {
  return (
    <div
      className="rounded-full bg-neutral-900 text-white grid place-items-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      🤖
    </div>
  );
}
