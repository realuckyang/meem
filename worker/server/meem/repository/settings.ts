import type { Env } from '../../types';
import { now } from './util';
import type { SettingsRepo, SettingsLite } from './types';

export function makeSettings(env: Env, uid: string): SettingsRepo {
  const DB = env.DB;
  const ensure = () => DB.prepare('INSERT OR IGNORE INTO settings (meem_uid) VALUES (?)').bind(uid).run();
  return {
    async loadSettings() {
      await ensure();
      const s = await DB.prepare('SELECT llm_url,llm_key,llm_model,max_rounds,persona,vision FROM settings WHERE meem_uid=?').bind(uid).first<SettingsLite>();
      return s ?? { llm_url: '', llm_key: '', llm_model: '', max_rounds: 30, persona: '', vision: 0 };
    },
    async getSettings() { await ensure(); return (await DB.prepare('SELECT * FROM settings WHERE meem_uid=?').bind(uid).first()) ?? {}; },
    async updateSettings(p) {
      await ensure();
      const allow = ['persona', 'llm_url', 'llm_key', 'llm_model', 'max_rounds', 'vision'];
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of allow) if (p[k] !== undefined) { cols.push(`${k}=?`); vals.push(p[k]); }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), uid);
      await DB.prepare(`UPDATE settings SET ${cols.join(',')} WHERE meem_uid=?`).bind(...vals).run();
    },
  };
}
