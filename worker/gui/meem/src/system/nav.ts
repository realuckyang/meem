import { createContext, useContext } from 'react';
import type { AppId } from './registry';

export type InstallKind = 'client' | 'extension';

export interface MeemNav {
  activeApp: AppId;
  openApp: (app: AppId) => void;
  openInstall: (kind: InstallKind) => void;
  openDevice: (id?: string) => void;   // 设备详情弹层(不传 id = 添加)
}

export const NavContext = createContext<MeemNav>({
  activeApp: 'chat',
  openApp: () => {},
  openInstall: () => {},
  openDevice: () => {},
});

export function useNav(): MeemNav {
  return useContext(NavContext);
}
