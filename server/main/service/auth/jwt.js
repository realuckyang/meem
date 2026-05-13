// 轻量 HS256 JWT(不引入 jose 依赖,自带 crypto 够用)
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSetting, setSetting } from '../../repository/settings.js'
import { findTokenByValue, touchToken } from '../../repository/tokens.js'
import { randomBytes } from 'node:crypto'

export const TOKEN_COOKIE = 'meem_token'
const TOKEN_MAX_AGE = 180 * 24 * 60 * 60  // 180 天
const SECRET_KEY    = 'jwt_secret'

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const b64urlDecode = (s) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4), 'base64')

const getSecret = () => {
  let s = getSetting(SECRET_KEY)
  if (!s) {
    s = randomBytes(32).toString('base64')
    setSetting(SECRET_KEY, s)
  }
  return s
}

export const signJwt = (payload = {}, { expSeconds = TOKEN_MAX_AGE } = {}) => {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const body   = { iat: now, exp: now + expSeconds, ...payload }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const sig = createHmac('sha256', getSecret()).update(`${h}.${p}`).digest()
  return `${h}.${p}.${b64url(sig)}`
}

export const verifyJwt = (token) => {
  try {
    const [h, p, s] = String(token || '').split('.')
    if (!h || !p || !s) return null
    const expected = createHmac('sha256', getSecret()).update(`${h}.${p}`).digest()
    const got = b64urlDecode(s)
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null
    const payload = JSON.parse(b64urlDecode(p).toString('utf8'))
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch { return null }
}

export const buildAuthCookie = (token, { secure = false } = {}) => {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax']
  if (secure) attrs.push('Secure')
  attrs.push(`Max-Age=${TOKEN_MAX_AGE}`)
  return `${TOKEN_COOKIE}=${encodeURIComponent(token)}; ${attrs.join('; ')}`
}

export const clearAuthCookie = ({ secure = false } = {}) => {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax']
  if (secure) attrs.push('Secure')
  attrs.push('Max-Age=0')
  return `${TOKEN_COOKIE}=; ${attrs.join('; ')}`
}

// 鉴权:成功返回 { source: 'cookie' | 'api_token' };失败返回 null
export const getAuth = (req) => {
  // cookie
  const cookies = (() => {
    const out = {}
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=')
      if (i <= 0) continue
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
    }
    return out
  })()
  let token = cookies[TOKEN_COOKIE]
  if (!token) {
    const h = req.headers.authorization || ''
    if (h.startsWith('Bearer ')) token = h.slice(7)
  }
  if (!token) return null

  if (token.startsWith('mb_')) {
    const row = findTokenByValue(token)
    if (!row) return null
    try { touchToken(row.token_id) } catch {}
    return { source: 'api_token', scope: row.scope }
  }
  const payload = verifyJwt(token)
  return payload ? { source: 'cookie' } : null
}

export const isAuthenticated = (req) => !!getAuth(req)
