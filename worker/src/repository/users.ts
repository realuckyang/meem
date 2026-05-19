import type { AuthUser, Env } from '../types';

export async function loadUserByHandle(env: Env, handle: string): Promise<AuthUser | null> {
  return env.DB.prepare(
    `SELECT id, handle, name, password_salt, password_hash, auth_secret
     FROM users WHERE handle = ?`,
  ).bind(handle).first<AuthUser>();
}

export async function loadUserById(env: Env, id: string): Promise<AuthUser | null> {
  return env.DB.prepare(
    `SELECT id, handle, name, password_salt, password_hash, auth_secret
     FROM users WHERE id = ?`,
  ).bind(id).first<AuthUser>();
}

export async function usersCount(env: Env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  return Number(row?.count || 0);
}

export async function insertUser(env: Env, user: AuthUser, ts: number) {
  await env.DB.prepare(
    `INSERT INTO users (id, handle, name, password_salt, password_hash, auth_secret, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    user.id,
    user.handle,
    user.name,
    user.password_salt,
    user.password_hash,
    user.auth_secret,
    ts,
    ts,
  ).run();
}

export async function listUsers(env: Env) {
  const rs = await env.DB.prepare(
    `SELECT id, handle, name, created_at, updated_at
     FROM users ORDER BY handle ASC LIMIT 500`,
  ).all<{ id: string; handle: string; name: string; created_at: number; updated_at: number }>();
  return rs.results || [];
}
