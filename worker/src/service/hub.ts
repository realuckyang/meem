import type { Env } from '../types';

export const hubStub = (env: Env) => env.HUB.get(env.HUB.idFromName('default'));

export async function notifyHub(env: Env, userId: string, frame: unknown) {
  await hubStub(env).fetch('https://hub/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: userId, frame }),
  });
}

export async function presence(env: Env, userId: string) {
  const res = await hubStub(env).fetch(`https://hub/presence?user=${userId}`);
  return res.json();
}
