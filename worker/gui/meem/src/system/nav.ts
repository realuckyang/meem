import { createContext, useContext } from 'react';
import type { AppId } from './registry';

export type InstallKind = 'client' | 'extension';

export interface MeemNav {
  activeApp: AppId;
  openApp: (app: AppId) => void;
  openInstall: (kind: InstallKind) => void;
}

export const NavContext = createContext<MeemNav>({
  activeApp: 'chat',
  openApp: () => {},
  openInstall: () => {},
});

export function useNav(): MeemNav {
  return useContext(NavContext);
}
