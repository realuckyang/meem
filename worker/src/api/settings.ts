import type { Hono } from 'hono';
import { VALID_MODES } from '../lib/constants';
import { now } from '../lib/id';
import { loadSettings, upsertSettings } from '../repository/settings';
import type { AppVariables, Env, Mode } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountSettingsApi(app: App) {
  app.get('/api/settings', async (c) => {
    return c.json(await loadSettings(c.env, c.get('userId')));
  });

  app.put('/api/settings', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ prompt?: string; public_messages_enabled?: boolean; mode_direct?: string; mode_message_agent?: string }>()
      .catch(() => ({} as { prompt?: string; public_messages_enabled?: boolean; mode_direct?: string; mode_message_agent?: string }));
    const current = await loadSettings(c.env, userId);
    const settings = {
      prompt: typeof body.prompt === 'string' ? body.prompt : current.prompt,
      public_messages_enabled: typeof body.public_messages_enabled === 'boolean'
        ? body.public_messages_enabled
        : current.public_messages_enabled,
      mode_direct: VALID_MODES.includes(body.mode_direct as Mode)
        ? (body.mode_direct as Mode)
        : current.mode_direct,
      mode_message_agent: VALID_MODES.includes(body.mode_message_agent as Mode)
        ? (body.mode_message_agent as Mode)
        : current.mode_message_agent,
    };
    const ts = now();
    await upsertSettings(c.env, userId, settings, ts);
    return c.json({ ...settings, updated_at: ts });
  });
}
