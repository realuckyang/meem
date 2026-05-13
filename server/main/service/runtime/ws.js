// WebSocket 基础设施:
// - 单一入口 /ws,鉴权同 HTTP(走 cookie JWT)
// - send/broadcast/sendTo 三个发送方式
// - 用 type 字段分发到对应 handler,handler 在别处通过 registerHandler 注册

import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import { isAuthenticated } from '../auth/index.js'

const clients = new Map()  // clientId → { ws, meta }
const handlers = new Map() // type → async (msg, ctx) => any

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

export const registerHandler = (type, fn) => {
  handlers.set(type, fn)
}

const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (ws, req) => {
  const clientId = randomUUID()
  clients.set(clientId, { ws })

  const send = (obj) => sendOne(ws, safeStringify(obj))
  send({ type: 'hello', clientId })

  ws.on('message', async (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    const type = String(msg?.type || '')
    const fn = handlers.get(type)
    if (!fn) {
      send({ type: 'error', message: `unknown_type: ${type}`, req_id: msg?.req_id })
      return
    }
    try {
      await fn(msg, { send, clientId, req: req })
    } catch (err) {
      console.error('[ws]', type, err?.stack || err)
      send({ type: 'error', message: err?.message || 'handler_error', req_id: msg?.req_id })
    }
  })

  ws.on('close', () => { clients.delete(clientId) })
  ws.on('error', (err) => { console.error('[ws-client]', err?.message) })
})

export const setupWebSocket = (httpServer) => {
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      if (url.pathname !== '/ws') { socket.destroy(); return }
      if (!isAuthenticated(req)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    } catch (err) {
      console.error('[ws-upgrade]', err?.message)
      try { socket.destroy() } catch {}
    }
  })
}
