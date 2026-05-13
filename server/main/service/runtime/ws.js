// WebSocket 基础设施。
// 支持两种 handler 注册方式:
// 1. registerHandler(type, fn) —— 精确匹配 type,适合 ESM 内部模块(例如 chat)
// 2. CJS WS-app(对齐 AIOS):模块 exports { name, wsMatch(type), handleWs(msg),
//    init?, onClientConnect?, shutdown? }。通过 createRequire 在本文件顶部加载,
//    优先于 registerHandler 接管消息。这些 app 通过 globalThis.__meem_ws__
//    反向调 broadcast/sendToClient。

import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { isAuthenticated } from '../auth/index.js'

const require = createRequire(import.meta.url)

const clients = new Map()   // clientId → { ws }
const handlers = new Map()  // type → async (msg, ctx) => any
const wsApps = []           // 注册的 CJS WS-apps

const safeStringify = (obj) => {
  try { return JSON.stringify(obj) } catch { return JSON.stringify({ type: 'error', message: 'serialize_failed' }) }
}

const sendOne = (ws, payload) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(payload)
}

export const broadcast = (msg) => {
  const payload = safeStringify(msg)
  for (const { ws } of clients.values()) sendOne(ws, payload)
}

export const sendTo = (clientId, msg) => {
  const c = clients.get(clientId)
  if (c) sendOne(c.ws, safeStringify(msg))
}

export const registerHandler = (type, fn) => { handlers.set(type, fn) }

// 暴露给 CJS apps 反向调用
globalThis.__meem_ws__ = {
  broadcast: (msg) => broadcast(msg),
  sendToClient: (clientId, msg) => sendTo(clientId, msg),
}

// 尝试加载一个 CJS WS-app,失败不致命(例如 node-pty 编译失败时 terminal 加载失败)
const tryLoadWsApp = (modulePath) => {
  try {
    const mod = require(modulePath)
    if (!mod || typeof mod.wsMatch !== 'function' || typeof mod.handleWs !== 'function') {
      console.warn(`[ws-app] ${modulePath} 缺 wsMatch/handleWs,跳过`)
      return
    }
    wsApps.push(mod)
    console.log(`[ws-app] loaded ${mod.name || modulePath}`)
  } catch (err) {
    console.error(`[ws-app] 加载 ${modulePath} 失败: ${err?.message || err}`)
  }
}

// 注册需要挂在 WS 通道上的 CJS app
tryLoadWsApp('../../../apps/terminal/index.js')
tryLoadWsApp('../../../apps/files/index.js')

let initialized = false
const initWsAppsOnce = async () => {
  if (initialized) return
  initialized = true
  for (const app of wsApps) {
    if (typeof app.init !== 'function') continue
    try { await app.init() }
    catch (err) { console.error(`[ws-app init ${app.name}]`, err?.message || err) }
  }
}

// perMessageDeflate=false:聊天是小帧流,zlib 会攒帧导致"吐两个字→卡→一次吐完"。
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false })

wss.on('connection', (ws, req) => {
  const clientId = randomUUID()
  clients.set(clientId, { ws })

  const send = (obj) => sendOne(ws, safeStringify(obj))
  send({ type: 'hello', clientId })

  // 给每个 WS app 一次"客户端来了"的通知(例如终端会回当前快照)
  for (const app of wsApps) {
    if (typeof app.onClientConnect !== 'function') continue
    try { app.onClientConnect(clientId) }
    catch (err) { console.error(`[ws-app connect ${app.name}]`, err?.message || err) }
  }

  ws.on('message', async (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    const type = String(msg?.type || '')

    // 1. CJS WS-apps 优先接管
    for (const app of wsApps) {
      if (typeof app.wsMatch === 'function' && app.wsMatch(type)) {
        try {
          msg.meta = { ...(msg.meta || {}), clientId }
          await app.handleWs(msg)
        } catch (err) {
          console.error(`[ws-app ${app.name}]`, err?.message || err)
          send({ type: 'error', message: err?.message || 'app_handler_error' })
        }
        return
      }
    }

    // 2. registerHandler 注册的精确类型(例如 chat.send)
    const fn = handlers.get(type)
    if (!fn) {
      send({ type: 'error', message: `unknown_type: ${type}`, req_id: msg?.req_id })
      return
    }
    try { await fn(msg, { send, clientId, req }) }
    catch (err) {
      console.error('[ws]', type, err?.stack || err)
      send({ type: 'error', message: err?.message || 'handler_error', req_id: msg?.req_id })
    }
  })

  ws.on('close', () => clients.delete(clientId))
  ws.on('error', (err) => console.error('[ws-client]', err?.message))
})

export const setupWebSocket = (httpServer) => {
  initWsAppsOnce().catch(err => console.error('[ws-init]', err?.message))
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      if (url.pathname !== '/ws') { socket.destroy(); return }
      if (!isAuthenticated(req)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      try { socket.setNoDelay(true) } catch {}
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    } catch (err) {
      console.error('[ws-upgrade]', err?.message)
      try { socket.destroy() } catch {}
    }
  })
}
