import type { Env } from '../types';
import type { Ctx } from './helpers';
import { json } from './helpers';

export async function handleSettings(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  if (ctx.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM settings WHERE uid = ?').bind(ctx.me.id).first();
    return json(row);
  }
  if (ctx.method === 'PATCH') {
    const body = await request.json<any>();
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (body.prompt !== undefined) { fields.push('prompt = ?'); vals.push(body.prompt); }
    if (body.public !== undefined) { fields.push('public = ?'); vals.push(body.public ? 1 : 0); }
    if (body.whisper_mode !== undefined) {
      const m = String(body.whisper_mode);
      if (!['silent', 'suggest', 'auto'].includes(m)) return new Response(JSON.stringify({ error: 'invalid whisper_mode' }), { status: 400 });
      fields.push('whisper_mode = ?'); vals.push(m);
    }
    if (body.whisper_suggest_prompt !== undefined) { fields.push('whisper_suggest_prompt = ?'); vals.push(String(body.whisper_suggest_prompt)); }
    if (body.whisper_auto_prompt    !== undefined) { fields.push('whisper_auto_prompt = ?');    vals.push(String(body.whisper_auto_prompt)); }
    if (body.url !== undefined) { fields.push('url = ?'); vals.push(body.url); }
    if (body.key !== undefined) { fields.push('"key" = ?'); vals.push(body.key); }
    if (body.model !== undefined) { fields.push('model = ?'); vals.push(body.model); }
    if (body.max_rounds !== undefined) { fields.push('max_rounds = ?'); vals.push(Math.max(1, Math.min(50, Number(body.max_rounds) || 20))); }
    if (body.tool_max_chars !== undefined) { fields.push('tool_max_chars = ?'); vals.push(Math.max(1000, Math.min(50000, Number(body.tool_max_chars) || 12000))); }
    if (body.vision !== undefined) { fields.push('vision = ?'); vals.push(body.vision ? 1 : 0); }
    if (fields.length) {
      vals.push(ctx.me.id);
      await env.DB.prepare(`UPDATE settings SET ${fields.join(', ')} WHERE uid = ?`).bind(...vals).run();
    }
    return json({ ok: true });
  }
  return new Response('method not allowed', { status: 405 });
}
