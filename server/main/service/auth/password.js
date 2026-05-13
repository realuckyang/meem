// PBKDF2-SHA256 100k 轮(Node 自带 crypto)
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto'

const ITERATIONS = 100_000
const KEY_BYTES  = 32
const SALT_BYTES = 16

export const hashPassword = (password) => {
  const salt = randomBytes(SALT_BYTES)
  const key  = pbkdf2Sync(String(password || ''), salt, ITERATIONS, KEY_BYTES, 'sha256')
  return { hash: key.toString('hex'), salt: salt.toString('hex') }
}

export const verifyPassword = (password, storedHashHex, storedSaltHex) => {
  try {
    const salt = Buffer.from(String(storedSaltHex || ''), 'hex')
    const key  = pbkdf2Sync(String(password || ''), salt, ITERATIONS, KEY_BYTES, 'sha256')
    const a = key
    const b = Buffer.from(String(storedHashHex || ''), 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch { return false }
}
