import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail } from '../../../shared/http/json.js'
import {
  hashPassword, verifyPassword,
  signJwt, buildAuthCookie, clearAuthCookie,
  isAuthenticated,
} from '../../service/auth/index.js'
import { getSetting, setSetting } from '../../repository/settings.js'

const K = {
  username: 'auth_username',
  hash:     'auth_password_hash',
  salt:     'auth_password_salt',
}
const MIN_PASSWORD = 6

const readAuth = () => ({
  username: getSetting(K.username) || '',
  hash:     getSetting(K.hash)     || '',
  salt:     getSetting(K.salt)     || '',
})

const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https'

export const handleAuthApi = async (req, res, path) => {
  // GET /api/auth/status
  if (path === '/api/auth/status' && req.method === 'GET') {
    const a = readAuth()
    return ok(res, { initialized: !!(a.username && a.hash) })
  }

  // POST /api/auth/setup
  if (path === '/api/auth/setup' && req.method === 'POST') {
    const cur = readAuth()
    if (cur.username && cur.hash) return fail(res, 'already_initialized', 409)
    const body = await readBody(req)
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '')
    if (!username) return fail(res, 'invalid_username', 400)
    if (password.length < MIN_PASSWORD) return fail(res, 'password_too_short', 400)
    const { hash, salt } = hashPassword(password)
    setSetting(K.username, username)
    setSetting(K.hash, hash)
    setSetting(K.salt, salt)
    const token = signJwt({ sub: 'owner' })
    return ok(res, { initialized: true }, 200, { 'Set-Cookie': buildAuthCookie(token, { secure: isHttps(req) }) })
  }

  // POST /api/auth/login
  if (path === '/api/auth/login' && req.method === 'POST') {
    const a = readAuth()
    if (!a.username || !a.hash) return fail(res, 'not_initialized', 409)
    const body = await readBody(req)
    const username = String(body?.username || '').trim()
    const password = String(body?.password || '')
    if (!username || !password) return fail(res, 'username_and_password_required', 400)
    if (username !== a.username) return fail(res, 'invalid_credentials', 401)
    if (!verifyPassword(password, a.hash, a.salt)) return fail(res, 'invalid_credentials', 401)
    const token = signJwt({ sub: 'owner' })
    return ok(res, {}, 200, { 'Set-Cookie': buildAuthCookie(token, { secure: isHttps(req) }) })
  }

  // POST /api/auth/logout
  if (path === '/api/auth/logout' && req.method === 'POST') {
    return ok(res, {}, 200, { 'Set-Cookie': clearAuthCookie({ secure: isHttps(req) }) })
  }

  // GET /api/auth/me
  if (path === '/api/auth/me' && req.method === 'GET') {
    if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)
    return ok(res, { authenticated: true })
  }

  // POST /api/auth/password — 改密码
  if (path === '/api/auth/password' && req.method === 'POST') {
    if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)
    const a = readAuth()
    if (!a.username || !a.hash) return fail(res, 'not_initialized', 409)
    const body = await readBody(req)
    const oldPwd = String(body?.old_password || '')
    const newPwd = String(body?.new_password || '')
    if (newPwd.length < MIN_PASSWORD) return fail(res, 'password_too_short', 400)
    if (!verifyPassword(oldPwd, a.hash, a.salt)) return fail(res, 'invalid_old_password', 401)
    const { hash, salt } = hashPassword(newPwd)
    setSetting(K.hash, hash)
    setSetting(K.salt, salt)
    return ok(res, {})
  }

  return false
}
