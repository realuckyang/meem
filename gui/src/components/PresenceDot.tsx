// 在线状态小圆点：
//   - 绿：有浏览器扩展（智能体常驻）
//   - 黄：仅网页连接（无扩展兜底，关掉就掉线）
//   - 不显示：完全离线

import type { UserStatus } from '../lib/presence';

interface Props {
  status?: UserStatus;
  size?: number;          // 圆点直径 px
  ring?: boolean;         // 外圈白边（覆盖头像时用）
}

export default function PresenceDot({ status, size = 9, ring = false }: Props) {
  if (!status?.online) return null;
  const color = (status.extension || status.extensionBg) ? 'bg-emerald-500' : 'bg-amber-400';
  return (
    <span
      className={`inline-block rounded-full ${color} ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size }}
      title={(status.extension || status.extensionBg) ? '在线 · 浏览器已连接' : '在线 · 仅网页'}
    />
  );
}

// Avatar 上的右下角浮起小点
export function AvatarPresence({ status, size = 10 }: { status?: UserStatus; size?: number }) {
  if (!status?.online) return null;
  return (
    <span
      className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white ${(status.extension || status.extensionBg) ? 'bg-emerald-500' : 'bg-amber-400'}`}
      style={{ width: size, height: size }}
    />
  );
}
