import { createServer } from 'node:http'
import { URL as NodeURL } from 'node:url'
import { json, fail } from '../shared/http/json.js'
import { initSystemTables } from '../main/repository/init.js'
import { appLoaders } from './registry.js'

const portArg = process.argv.find(a => a.startsWith('--port='))
const PORT = portArg ? Number(portArg.slice('--port='.length)) : 9508
const HOST = '127.0.0.1'

const moduleCache = new Map()
const appModules = []
const dbInitCache = new Set()

const loadAppModule = async (load) => {
  if (moduleCache.has(load)) return moduleCache.get(load)
  const mod = await load()
  const app = mod?.default
  if (!app || typeof app !== 'object') throw new Error('Invalid app module: missing default export')
  if (!app.name || typeof app.match !== 'function' || typeof app.handleApi !== 'function') {
    throw new Error(`Invalid app module: name/match/handleApi missing`)
  }
  moduleCache.set(load, app)
  return app
}

const initDbForApp = async (app) => {
  if (dbInitCache.has(app.name)) return
  if (typeof app.initDb === 'function') await app.initDb()
  dbInitCache.add(app.name)
}

const bootApps = async () => {
  for (const load of appLoaders) appModules.push(await loadAppModule(load))
  for (const app of appModules) {
    await initDbForApp(app)
    if (typeof app.initRuntime === 'function') await app.initRuntime()
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new NodeURL(req.url, `http://${req.headers.host}`)
    const path = url.pathname
    if (path === '/apps/health') return json(res, { success: true })
    const app = appModules.find(m => m.match(path))
    if (!app) return fail(res, 'not_found', 404)
    const handled = await app.handleApi(req, res, path, url)
    if (handled === false && !res.headersSent) return fail(res, 'not_found', 404)
  } catch (err) {
    console.error('[apps]', err)
    if (!res.headersSent) fail(res, err?.message || 'internal_error', 500)
    else try { res.end() } catch {}
  }
})

initSystemTables()
await bootApps()
server.listen(PORT, HOST, () => {
  console.log(`🧩  meem apps (${appModules.map(a => a.name).join(', ')})`)
  console.log(`🌐  http://${HOST}:${PORT}`)
})
