const enc = new TextEncoder();

export const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

export async function sha256(text: string) {
  return crypto.subtle.digest('SHA-256', enc.encode(text));
}

export async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', key, enc.encode(payload));
}

export async function hashPassword(password: string, salt: string) {
  return b64url(await sha256(salt + password));
}

export async function signToken(userId: string, secret: string) {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(enc.encode(JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000) })));
  const sig = b64url(await hmac(secret, `${header}.${payload}`));
  return `${header}.${payload}.${sig}`;
}

export async function verifyToken(token: string, secret: string): Promise<string | null> {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return null;
    const expected = b64url(await hmac(secret, `${header}.${payload}`));
    if (sig !== expected) return null;
    const { sub } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return sub ?? null;
  } catch {
    return null;
  }
}
