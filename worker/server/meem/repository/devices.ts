import type { Env } from '../../types';
import { now, uuid } from './util';
import type { DevicesRepo, DeviceRow } from './types';

const COLS = 'id,meem_uid,kind,name,description,token,status,created,updated';
const genToken = () => {
  const a = crypto.getRandomValues(new Uint8Array(24));
  let raw = ''; for (const b of a) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function makeDevices(env: Env, uid: string): DevicesRepo {
  const DB = env.DB;
  return {
    async listDevices() {
      return (await DB.prepare(`SELECT ${COLS} FROM devices WHERE meem_uid=? ORDER BY kind, created`).bind(uid).all<DeviceRow>()).results;
    },
    async getDevice(id) {
      return DB.prepare(`SELECT ${COLS} FROM devices WHERE id=? AND meem_uid=?`).bind(id, uid).first<DeviceRow>();
    },
    async createDevice(p) {
      const id = uuid();
      const token = genToken();
      await DB.prepare(`INSERT INTO devices (${COLS}) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(id, uid, p.kind === 'browser' ? 'browser' : 'computer', p.name ?? '', p.description ?? '', token, 'active', now(), now()).run();
      return (await this.getDevice(id))!;
    },
    async updateDevice(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['name', 'description', 'status'] as const) if ((p as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((p as any)[k]); }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE devices SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
    async deleteDevice(id) {
      await DB.prepare('DELETE FROM devices WHERE id=? AND meem_uid=?').bind(id, uid).run();
    },
  };
}

/** 设备连接鉴权:token 唯一标识一台设备,反查出 id/uid/kind */
export async function verifyDevice(env: Env, token: string): Promise<{ id: string; uid: string; kind: string } | null> {
  if (!token) return null;
  const row = await env.DB.prepare("SELECT id,meem_uid,kind FROM devices WHERE token=? AND status='active'").bind(token).first<{ id: string; meem_uid: string; kind: string }>();
  return row ? { id: row.id, uid: row.meem_uid, kind: row.kind } : null;
}
