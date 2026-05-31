// 对外网站访客账号 · 与站主 meem_users 完全分离
//   · token claim 用 { vid }(不是 uid:'me'),所以永远过不了 /meem 的 authorize
//   · 每个访客一个持久对话(site_visitor_msgs)

import { decodeJwt, jwtVerify, SignJWT } from 'jose';
import type { Env } from '../types';
import { getUser, hashPassword, verifyPassword } from '../meem/auth';

const enc = new TextEncoder();
const ALG = 'HS256';

export interface Visitor { id: string; email: string; name: string; salt: string; hash: string; status: string; created: number; last_seen: number; }

const profile = (v: Visitor) => ({ id: v.id, email: v.email, name: v.name });

async function secret(env: Env): Promise<string> {
  const owner = await getUser(env);
  return owner?.secret || 'meem-visitor-fallback';
}

async function signVisitor(env: Env, v: Visitor): Promise<string> {
  return new SignJWT({ vid: v.id, scope: 'visitor' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .sign(enc.encode(await secret(env)));
}

export async function verifyVisitor(req: Request, env: Env): Promise<Visitor | null> {
  const auth = req.headers.get('Authorization') || '';
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1] || '';
  if (!token) return null;
  let vid = '';
  try {
    const c = decodeJwt(token);
    if (c.scope !== 'visitor') return null;
    vid = String(c.vid || '');
  } catch { return null; }
  if (!vid) return null;
  try { await jwtVerify(token, enc.encode(await secret(env)), { algorithms: [ALG] }); } catch { return null; }
  const v = await env.DB.prepare('SELECT * FROM site_visitors WHERE id=?').bind(vid).first<Visitor>();
  return v && v.status === 'active' ? v : null;
}

const normEmail = (e: unknown) => String(e || '').trim().toLowerCase().slice(0, 160);

export async function register(env: Env, body: any) {
  const email = normEmail(body.email);
  const name = String(body.name || '').trim().slice(0, 40) || email.split('@')[0] || '访客';
  const password = String(body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'invalid_email', status: 400 };
  if (password.length < 6) return { error: 'password_too_short', status: 400 };
  const exists = await env.DB.prepare('SELECT id FROM site_visitors WHERE email=?').bind(email).first();
  if (exists) return { error: 'email_taken', status: 409 };
  const { salt, hash } = await hashPassword(password);
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO site_visitors (id,email,name,salt,hash,status,created,last_seen) VALUES (?,?,?,?,?,?,unixepoch(),unixepoch())')
    .bind(id, email, name, salt, hash, 'active').run();
  const v = await env.DB.prepare('SELECT * FROM site_visitors WHERE id=?').bind(id).first<Visitor>();
  return { token: await signVisitor(env, v!), profile: profile(v!) };
}

export async function login(env: Env, body: any) {
  const email = normEmail(body.email);
  const password = String(body.password || '');
  const v = await env.DB.prepare('SELECT * FROM site_visitors WHERE email=?').bind(email).first<Visitor>();
  if (!v || v.status !== 'active') return { error: 'unauthorized', status: 401 };
  if (!(await verifyPassword(password, v.salt, v.hash))) return { error: 'unauthorized', status: 401 };
  await env.DB.prepare('UPDATE site_visitors SET last_seen=unixepoch() WHERE id=?').bind(v.id).run();
  return { token: await signVisitor(env, v), profile: profile(v) };
}

export const visitorProfile = profile;

export async function loadConversation(env: Env, visitorId: string, limit = 50) {
  const r = await env.DB.prepare('SELECT role,content,created FROM site_visitor_msgs WHERE visitor_id=? ORDER BY created DESC LIMIT ?')
    .bind(visitorId, limit).all<{ role: string; content: string; created: number }>();
  return r.results.reverse();
}

export async function appendMessage(env: Env, visitorId: string, role: string, content: string) {
  await env.DB.prepare('INSERT INTO site_visitor_msgs (id,visitor_id,role,content,created) VALUES (?,?,?,?,unixepoch())')
    .bind(crypto.randomUUID(), visitorId, role, content.slice(0, 4000)).run();
}
