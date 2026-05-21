// usePresence(handles) —— 批量轮询若干用户的在线/扩展状态。
//
// 30 秒一刷，handles 数组内容变了立即重新拉。
// 返回 { [handle]: { online, extension, web } }——未拉到的 handle 不在 map 里（视为 offline）。

import { useEffect, useState } from 'react';
import { req } from './api';

export interface UserStatus {
  online: boolean;
  extension: boolean;
  web: boolean;
  extensionBg?: boolean;
}

export const OFFLINE: UserStatus = { online: false, extension: false, web: false };

const POLL_INTERVAL = 30_000;

export function usePresence(handles: string[]): Record<string, UserStatus> {
  const [map, setMap] = useState<Record<string, UserStatus>>({});
  const key = Array.from(new Set(handles.filter(Boolean))).sort().join(',');

  useEffect(() => {
    if (!key) { setMap({}); return; }

    let alive = true;
    const fetchNow = async () => {
      try {
        const r = await req<Record<string, UserStatus>>(`/api/presence?handles=${encodeURIComponent(key)}`);
        if (alive) setMap(r);
      } catch {}
    };
    fetchNow();
    const timer = setInterval(fetchNow, POLL_INTERVAL);
    return () => { alive = false; clearInterval(timer); };
  }, [key]);

  return map;
}
