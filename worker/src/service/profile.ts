import { normalizeHandle } from '../lib/normalize';
import { loadUserByHandle } from '../repository/users';
import type { Env } from '../types';

export async function publicProfile(env: Env, origin: string, handle: string) {
  const user = await loadUserByHandle(env, handle);
  if (!user) return null;
  return {
    id: user.id,
    handle: user.handle,
    name: user.name || user.handle,
    address: `${origin}/u/${encodeURIComponent(user.handle)}`,
  };
}

export function handleFromPublicAddress(origin: string, address: string) {
  try {
    const url = new URL(address);
    if (url.origin !== origin) return null;
    const [head, handle] = url.pathname.split('/').filter(Boolean);
    return head === 'u' ? normalizeHandle(handle) : null;
  } catch {
    return null;
  }
}

export async function loadUserByPublicAddress(env: Env, origin: string, address: string) {
  const handle = handleFromPublicAddress(origin, address);
  return handle ? loadUserByHandle(env, handle) : null;
}
