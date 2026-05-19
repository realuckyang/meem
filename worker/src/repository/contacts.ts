import type { Env } from '../types';
import { newId } from '../lib/id';

export async function upsertContact(env: Env, userId: string, name: string, address: string, ts: number) {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO contacts (id, user_id, name, address, created_at, updated_at, last_contact_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, address) DO UPDATE SET
       name = excluded.name,
       updated_at = excluded.updated_at,
       last_contact_at = excluded.last_contact_at`,
  ).bind(id, userId, name, address, ts, ts, ts).run();
  const row = await env.DB.prepare(
    `SELECT id FROM contacts WHERE user_id = ? AND address = ?`,
  ).bind(userId, address).first<{ id: string }>();
  return row?.id || id;
}

export async function listContacts(env: Env, userId: string) {
  const rs = await env.DB.prepare(
    `SELECT id, name, address, note, created_at, updated_at, last_contact_at
     FROM contacts WHERE user_id = ?
     ORDER BY COALESCE(last_contact_at, updated_at) DESC LIMIT 500`,
  ).bind(userId).all();
  return rs.results || [];
}

export async function createOrUpdateContact(
  env: Env,
  userId: string,
  input: { name: string; address: string; note: string },
  ts: number,
) {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO contacts (id, user_id, name, address, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, address) DO UPDATE SET
       name = excluded.name,
       note = excluded.note,
       updated_at = excluded.updated_at`,
  ).bind(id, userId, input.name, input.address, input.note, ts, ts).run();
  return loadContactByAddress(env, userId, input.address);
}

export async function loadContactByAddress(env: Env, userId: string, address: string) {
  return env.DB.prepare(
    `SELECT id, name, address, note, created_at, updated_at, last_contact_at
     FROM contacts WHERE user_id = ? AND address = ?`,
  ).bind(userId, address).first();
}

export async function loadContactById(env: Env, userId: string, id: string) {
  return env.DB.prepare(
    `SELECT id, name, address, note, created_at, updated_at, last_contact_at
     FROM contacts WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first();
}

export async function patchContact(
  env: Env,
  userId: string,
  id: string,
  body: { name?: string; address?: string; note?: string },
  ts: number,
) {
  const sets: string[] = ['updated_at = ?'];
  const binds: any[] = [ts];
  if (typeof body.name === 'string') { sets.push('name = ?'); binds.push(body.name); }
  if (typeof body.address === 'string') { sets.push('address = ?'); binds.push(body.address); }
  if (typeof body.note === 'string') { sets.push('note = ?'); binds.push(body.note); }
  binds.push(id, userId);
  const r = await env.DB.prepare(
    `UPDATE contacts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
  ).bind(...binds).run();
  return Boolean(r.meta?.changes);
}

export async function deleteContact(env: Env, userId: string, id: string) {
  const r = await env.DB.prepare(
    `DELETE FROM contacts WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).run();
  return Boolean(r.meta?.changes);
}
