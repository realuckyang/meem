import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail } from '../../../shared/http/json.js'
import { isAuthenticated } from '../../service/auth/index.js'
import { getAllSettings, setSetting } from '../../repository/settings.js'
import { DEFAULT_SYSTEM_PROMPT } from '../../ai/system-prompt.js'

const ROUND_CHOICES = [30, 100, 500]
const DEFAULT_ROUNDS = 100
const WRITABLE = new Set([
  'ai_base_url',
  'ai_api_key',
  'ai_model',
  'ai_context_rounds',
  'ai_system_prompt',
  'memos_icon',
  'memos_cover',
  'home_name',
  'home_icon',
  'home_cover',
])
const normalizeRounds = (raw) => {
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_ROUNDS
  return ROUND_CHOICES.includes(n) ? n : DEFAULT_ROUNDS
}
const serialize = (all) => ({
  ai_base_url:              all.ai_base_url || '',
  ai_api_key:               all.ai_api_key  || '',
  ai_model:                 all.ai_model    || '',
  ai_context_rounds:        normalizeRounds(all.ai_context_rounds),
  ai_system_prompt:         all.ai_system_prompt || '',
  ai_system_prompt_default: DEFAULT_SYSTEM_PROMPT,
  memos_icon:               all.memos_icon  || '',
  memos_cover:              all.memos_cover || '',
  home_name:                all.home_name   || '',
  home_icon:                all.home_icon   || '',
  home_cover:               all.home_cover  || '',
})

export const handleSettingsApi = async (req, res, path) => {
  if (path === '/api/settings' && req.method === 'GET') {
    if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)
    return ok(res, { settings: serialize(getAllSettings()) })
  }
  if (path === '/api/settings' && req.method === 'PATCH') {
    if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)
    const body = await readBody(req) || {}
    for (const [k, v] of Object.entries(body)) {
      if (!WRITABLE.has(k)) continue
      const val = k === 'ai_context_rounds'
        ? String(normalizeRounds(v))
        : (v === '' || v === null ? null : String(v))
      setSetting(k, val)
    }
    return ok(res, { settings: serialize(getAllSettings()) })
  }
  return false
}
