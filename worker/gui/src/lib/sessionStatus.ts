import type { SessionStatus } from '../api';

export function statusLabel(status: SessionStatus) {
  switch (status) {
    case 'thinking': return '进行中';
    case 'awaiting_approval': return '等批准';
    case 'awaiting_input': return '等回答';
    case 'done': return '已完成';
    case 'cancelled': return '已取消';
    case 'errored': return '出错';
  }
}

export function visibleStatusLabel(status: SessionStatus) {
  return statusLabel(status);
}

// pill 配色（对应 index.css 里的 .meem-pill-*）
export function statusPillClass(status: SessionStatus) {
  switch (status) {
    case 'thinking':
    case 'awaiting_approval':
    case 'awaiting_input':
      return 'meem-pill meem-pill-amber';
    case 'done': return 'meem-pill meem-pill-emerald';
    case 'cancelled': return 'meem-pill meem-pill-neutral';
    case 'errored': return 'meem-pill meem-pill-rose';
  }
}
