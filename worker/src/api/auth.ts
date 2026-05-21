import { b64url, hashPassword, signToken } from '../auth';
import type { Env } from '../types';
import { err, json, newId } from './helpers';

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const { handle, password, name = '' } = await request.json<any>();
  if (!handle || !password) return err('handle and password required');
  const existing = await env.DB.prepare('SELECT id FROM users WHERE handle = ?').bind(handle).first();
  if (existing) return err('handle taken', 409);
  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(password, salt);
  const secret = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const id = newId();
  await env.DB.prepare('INSERT INTO users (id,handle,name,salt,hash,secret) VALUES (?,?,?,?,?,?)')
    .bind(id, handle, name, salt, hash, secret).run();
  await env.DB.prepare('INSERT INTO settings (uid) VALUES (?)').bind(id).run();
  const token = await signToken(id, secret);
  return json({ token, handle, name });
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { handle, password } = await request.json<any>();
  if (!handle || !password) return err('handle and password required');
  const user = await env.DB.prepare('SELECT id,handle,name,salt,hash,secret FROM users WHERE handle = ?')
    .bind(handle).first<{ id: string; handle: string; name: string; salt: string; hash: string; secret: string }>();
  if (!user) return err('invalid credentials', 401);
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.hash) return err('invalid credentials', 401);
  const token = await signToken(user.id, user.secret);
  return json({ token, handle: user.handle, name: user.name });
}
