import { json, fail } from '../../../shared/http/json.js'
import { isAuthenticated } from '../../service/auth/index.js'
import { getProviderCatalog } from '../../llm/providers.js'

export const handleLlmApi = async (req, res, path) => {
  if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)
  if (path === '/api/llm/providers' && req.method === 'GET') {
    return json(res, getProviderCatalog())
  }
  return false
}
