import { SignJWT } from 'jose';
import type { AuthUser } from '../types';
import { bytesToHex } from './id';

const encoder = new TextEncoder();

export async function sha256Hex(value: string) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

export async function passwordHash(password: string, salt: string) {
  return sha256Hex(`${salt}:${password}`);
}

export function secretKey(secret: string) {
  return encoder.encode(secret);
}

export async function signToken(user: AuthUser) {
  if (!user.auth_secret) throw new Error('auth secret missing');
  return new SignJWT({ handle: user.handle })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer('meem')
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey(user.auth_secret));
}
