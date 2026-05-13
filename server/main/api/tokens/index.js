import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail } from '../../../shared/http/json.js'
import { getAuth } from '../../service/auth/index.js'
import { listTokens, createToken, deleteAllTokens, deleteToken } from '../../repository/tokens.js'
import { randomBytes } from 'node:crypto'

const generateApiToken = () => 'mb_' + randomBytes(24).toString('hex')
const randomId = () => randomBytes(6).toString('hex')

const requireCookie = (req) => {
  const a = getAuth(req)
  if (!a) return 'unauthorized'
  if (a.source === 'api_token') return 'token_cannot_manage_tokens'
  return null
}

export const handleTokensApi = async (req, res, path) => {
  if (path === '/api/tokens' && req.method === 'GET') {
    const e = requireCookie(req); if (e) return fail(res, e, e === 'unauthorized' ? 401 : 403)
    return ok(res, { tokens: listTokens() })
  }
  if (path === '/api/tokens' && req.method === 'POST') {
    const e = requireCookie(req); if (e) return fail(res, e, e === 'unauthorized' ? 401 : 403)
    const body = await readBody(req)
    const name = String(body?.name || 'AI').trim().slice(0, 60) || 'AI'
    deleteAllTokens()
    const token = createToken({ id: randomId(), name, token: generateApiToken() })
    return ok(res, { token }, 201)
  }
  const m = path.match(/^\/api\/tokens\/([0-9a-zA-Z]+)$/)
  if (m && req.method === 'DELETE') {
    const e = requireCookie(req); if (e) return fail(res, e, e === 'unauthorized' ? 401 : 403)
    deleteToken(m[1])
    return ok(res, { deleted: true })
  }
  return false
}
