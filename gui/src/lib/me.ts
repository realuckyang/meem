import { createContext, useContext } from 'react';
import type { Me } from './api';

export interface MeContextValue {
  me: Me;
  refresh: () => Promise<void>;
  logout: () => void;
}

export const MeContext = createContext<MeContextValue | null>(null);

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used inside MeContext.Provider');
  return ctx;
}
