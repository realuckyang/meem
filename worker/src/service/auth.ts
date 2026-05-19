import { decodeJwt, jwtVerify } from 'jose';
import { randomHex, now, newId } from '../lib/id';
import { passwordHash, secretKey } from '../lib/password';
import { insertDefaultSettings } from '../repository/settings';
import { insertUser, loadUserByHandle, loadUserById } from '../repository/users';
import type { AuthUser, Env } from '../types';

export async function createUser(env: Env, handle: string, password: string) {
  const userId = newId();
  const ts = now();
  const salt = randomHex(16);
  const hash = await passwordHash(password, salt);
  const secret = randomHex(32);
  const user: AuthUser = {
    id: userId,
    handle,
    name: handle,
    password_salt: salt,
    password_hash: hash,
    auth_secret: secret,
  };
  await insertUser(env, user, ts);
  await insertDefaultSettings(env, userId, ts);
  return user;
}

export async function authenticatePassword(env: Env, handle: string, password: string) {
  const user = await loadUserByHandle(env, handle);
  if (!user?.password_salt || !user.password_hash || !user.auth_secret) return null;
  const hash = await passwordHash(password, user.password_salt);
  return hash === user.password_hash ? user : null;
}

export async function authorized(env: Env, raw: string): Promise<AuthUser | null> {
  if (!raw) return null;
  try {
    const decoded = decodeJwt(raw);
    const userId = String(decoded.sub || '');
    if (!userId) return null;
    const user = await loadUserById(env, userId);
    if (!user?.auth_secret) return null;
    const result = await jwtVerify(raw, secretKey(user.auth_secret), {
      issuer: 'meem',
      subject: user.id,
    });
    return result.payload.sub === user.id ? user : null;
  } catch {
    return null;
  }
}
