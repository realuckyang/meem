import type { Env } from '../../types';
import { now } from './util';
import type { RateLimitRepo } from './types';

// 固定窗口限流(公网门童/留言)
export function makeRateLimit(env: Env): RateLimitRepo {
  const DB = env.DB;
  return {
    async rateHit(bucket, windowSec, limit) {
      const t = now();
      const row = await DB.prepare('SELECT win_start,count FROM site_ratelimit WHERE bucket=?').bind(bucket).first<{ win_start: number; count: number }>();
      if (!row || t - row.win_start >= windowSec) {
        await DB.prepare('INSERT INTO site_ratelimit (bucket,win_start,count) VALUES (?,?,1) ON CONFLICT(bucket) DO UPDATE SET win_start=excluded.win_start, count=1').bind(bucket, t).run();
        return true;
      }
      if (row.count >= limit) return false;
      await DB.prepare('UPDATE site_ratelimit SET count=count+1 WHERE bucket=?').bind(bucket).run();
      return true;
    },
  };
}
