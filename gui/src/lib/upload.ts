// 上传图片到 /api/media/upload。文件 → ArrayBuffer → POST 二进制。
import { API_BASE } from './env';

export async function uploadImage(file: File): Promise<string> {
  const token = localStorage.getItem('meem_token') ?? '';
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
  const res = await fetch(`${API_BASE}/api/media/upload?ext=${safeExt}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || `image/${safeExt}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await file.arrayBuffer(),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as any;
    throw new Error(e?.error ?? res.statusText);
  }
  const data = await res.json() as { url: string };
  return data.url;
}
