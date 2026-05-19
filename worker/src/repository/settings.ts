import { DEFAULT_PROMPT } from '../lib/constants';
import type { Env, Mode, Settings } from '../types';

export async function loadSettings(env: Env, userId: string): Promise<Settings> {
  const row = await env.DB.prepare(
    'SELECT prompt, public_messages_enabled, mode_direct, mode_message_agent FROM settings WHERE user_id = ?',
  ).bind(userId).first<{ prompt: string; public_messages_enabled: number; mode_direct: Mode; mode_message_agent: Mode }>();
  return {
    prompt: row?.prompt || DEFAULT_PROMPT,
    public_messages_enabled: row?.public_messages_enabled !== 0,
    mode_direct: row?.mode_direct || 'managed',
    mode_message_agent: row?.mode_message_agent || 'managed',
  };
}

export async function insertDefaultSettings(env: Env, userId: string, ts: number) {
  await env.DB.prepare(
    `INSERT INTO settings (user_id, prompt, public_messages_enabled, mode_direct, mode_message_agent, created_at, updated_at)
     VALUES (?, ?, 1, 'managed', 'managed', ?, ?)`,
  ).bind(userId, DEFAULT_PROMPT, ts, ts).run();
}

export async function upsertSettings(env: Env, userId: string, settings: Settings, ts: number) {
  await env.DB.prepare(
    `INSERT INTO settings (user_id, prompt, public_messages_enabled, mode_direct, mode_message_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       prompt = excluded.prompt,
       public_messages_enabled = excluded.public_messages_enabled,
       mode_direct = excluded.mode_direct,
       mode_message_agent = excluded.mode_message_agent,
       updated_at = excluded.updated_at`,
  ).bind(
    userId,
    settings.prompt,
    settings.public_messages_enabled ? 1 : 0,
    settings.mode_direct,
    settings.mode_message_agent,
    ts,
    ts,
  ).run();
}
