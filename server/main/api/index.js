import { handleAuthApi }     from './auth/index.js'
import { handleSettingsApi } from './settings/index.js'
import { handleChatApi }     from './chat/index.js'
import { handleSearchApi }   from './search/index.js'
import { fail }              from '../../shared/http/json.js'
import { isAuthenticated }   from '../service/auth/index.js'
import http from 'node:http'

const APPS_PORT = Number(process.env.MEEM_APPS_PORT || 9508)

// 反代到 apps 进程
const proxyToApps = (req, res, path, url) => new Promise((resolve) => {
  if (!isAuthenticated(req)) { fail(res, 'unauthorized', 401); return resolve() }
  const headers = { ...req.headers }
  delete headers.host
  const upstream = http.request({
    host: '127.0.0.1', port: APPS_PORT, method: req.method, path: url.pathname + url.search, headers,
  }, (upRes) => {
    res.writeHead(upRes.statusCode || 502, upRes.headers)
    upRes.pipe(res)
    upRes.on('end', resolve)
  })
  upstream.on('error', (err) => {
    if (!res.headersSent) fail(res, `apps_proxy_failed: ${err.message}`, 502)
    else { try { res.end() } catch {} }
    resolve()
  })
  if (req.method === 'GET' || req.method === 'HEAD') upstream.end()
  else req.pipe(upstream)
})

export const handleMainApi = async (req, res, path, url) => {
  if (path.startsWith('/api/auth'))     return (await handleAuthApi(req, res, path))     !== false
  if (path.startsWith('/api/settings')) return (await handleSettingsApi(req, res, path)) !== false
  if (path.startsWith('/api/chat'))     return (await handleChatApi(req, res, path, url))!== false
  if (path.startsWith('/api/search'))   return (await handleSearchApi(req, res, path, url))!== false
  if (path.startsWith('/api/apps/') || path.startsWith('/apps/')) {
    await proxyToApps(req, res, path, url)
    return true
  }
  return false
}
