import { decodeJwt, jwtVerify, SignJWT } from 'jose';
import type { Env } from '../types';

const enc = new TextEncoder();
const ALG = 'HS256';
const UID = 'me';

export interface MeemUser {
  meem_uid: string;
  handle: string;
  name: string;
  salt: string;
  hash: string;
  secret: string;
  created: number;
  updated: number;
}

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let raw = '';
  for (const b of arr) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pbkdf2(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256);
  return b64u(bits);
}

export function newSecret(): string {
  return b64u(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = b64u(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await pbkdf2(password, salt) };
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const got = await pbkdf2(password, salt);
  if (got.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i += 1) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export async function getUser(env: Env): Promise<MeemUser | null> {
  try {
    return await env.DB.prepare('SELECT * FROM users WHERE meem_uid=?').bind(UID).first<MeemUser>();
  } catch {
    return null;
  }
}

export async function hasUser(env: Env): Promise<boolean> {
  return !!(await getUser(env));
}

export async function createUser(env: Env, password: string, name = 'Meem'): Promise<MeemUser> {
  const { salt, hash } = await hashPassword(password);
  const secret = newSecret();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('INSERT INTO users (meem_uid,handle,name,salt,hash,secret,created,updated) VALUES (?,?,?,?,?,?,?,?)')
    .bind(UID, 'me', name, salt, hash, secret, now, now).run();
  const user = await getUser(env);
  if (!user) throw new Error('setup_failed');
  return user;
}

export async function signToken(user: MeemUser): Promise<string> {
  return new SignJWT({ uid: user.meem_uid })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .sign(enc.encode(user.secret));
}

export async function verifyToken(env: Env, token: string): Promise<MeemUser | null> {
  if (!token) return null;
  let uid = '';
  try { uid = String(decodeJwt(token).uid || ''); } catch { return null; }
  if (uid !== UID) return null;
  const user = await getUser(env);
  if (!user) return null;
  try { await jwtVerify(token, enc.encode(user.secret), { algorithms: [ALG] }); } catch { return null; }
  return user;
}

export async function authorize(req: Request, env: Env): Promise<MeemUser | null> {
  const auth = req.headers.get('Authorization') || '';
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1] || new URL(req.url).searchParams.get('token') || '';
  return verifyToken(env, token);
}

export function publicUser(user: MeemUser): Record<string, unknown> {
  return { uid: user.meem_uid, handle: user.handle, name: user.name, created: user.created };
}
