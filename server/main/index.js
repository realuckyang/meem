import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, dirname, extname, join } from 'node:path'
import { fileURLToPath, URL as NodeURL } from 'node:url'
import { fail, json } from '../shared/http/json.js'
import { initSystemTables } from './repository/init.js'
import { handleMainApi } from './api/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const portArg = process.argv.find(a => a.startsWith('--port='))
const PORT = portArg ? Number(portArg.slice('--port='.length)) : 9507
process.env.MEEM_MAIN_PORT = String(PORT)

initSystemTables()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.json': 'application/json; charset=utf-8',
  '.zip':  'application/zip',
  '.ico':  'image/x-icon',
}
const GUI_DIST = resolve(__dirname, '..', '..', 'gui', 'dist')

const serveStatic = (req, res, urlPath) => {
  if (!process.env.MEEM_SERVE_GUI) return false
  if (!existsSync(GUI_DIST)) return false
  let target = urlPath === '/' ? '/index.html' : urlPath
  let abs = join(GUI_DIST, target)
  if (!abs.startsWith(GUI_DIST)) abs = join(GUI_DIST, '/index.html')
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    // SPA fallback
    abs = join(GUI_DIST, 'index.html')
  }
  const ext = extname(abs).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  createReadStream(abs).pipe(res)
  return true
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  const url = new NodeURL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  try {
    if (path === '/api/health') return json(res, { success: true, name: 'meem' })

    if (path.startsWith('/api/') || path.startsWith('/apps/')) {
      const handled = await handleMainApi(req, res, path, url)
      if (!handled) return fail(res, 'not_found', 404)
      return
    }

    if (serveStatic(req, res, path)) return
    return fail(res, 'not_found', 404)
  } catch (err) {
    console.error('[main]', err)
    if (!res.headersSent) fail(res, err?.message || 'internal_error', 500)
    else try { res.end() } catch {}
  }
})

server.listen(PORT, () => {
  console.log(`🌱  meem main`)
  console.log(`🌐  http://localhost:${PORT}`)
})
