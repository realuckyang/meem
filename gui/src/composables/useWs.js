// 全局单例 WebSocket:首个调用方触发 connect,后续都共享同一个连接。
// 自动重连(指数退避),subscribe(type, cb) 注册按 type 分发。
import { ref, onUnmounted } from 'vue'

let ws = null
const listeners = new Map() // type → Set<cb>
const taps = new Set()      // tap(cb) → cb({ dir, type, msg, t, bytes })
const status = ref('idle')  // idle | connecting | open | closed
let reconnectTimer = null
let reconnectAttempt = 0

const tap = (dir, msg, bytes) => {
  if (!taps.size) return
  const evt = { dir, type: msg?.type || '(?)', msg, t: performance.now(), bytes }
  for (const cb of taps) { try { cb(evt) } catch (e) { console.error('ws tap', e) } }
}

const url = () => {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws`
}

const dispatch = (msg) => {
  const set = listeners.get(msg?.type)
  if (set) for (const cb of set) { try { cb(msg) } catch (e) { console.error('ws cb', e) } }
}

const connect = () => {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  status.value = 'connecting'
  ws = new WebSocket(url())
  ws.onopen = () => {
    status.value = 'open'
    reconnectAttempt = 0
    dispatch({ type: '_open' })
  }
  ws.onmessage = (e) => {
    let msg
    try { msg = JSON.parse(e.data) } catch { return }
    tap('in', msg, typeof e.data === 'string' ? e.data.length : 0)
    dispatch(msg)
  }
  ws.onclose = () => {
    status.value = 'closed'
    ws = null
    if (reconnectTimer) return
    const delay = Math.min(30_000, 500 * Math.pow(2, reconnectAttempt++))
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, delay)
  }
  ws.onerror = () => { /* onclose 会跟着触发 */ }
}

const send = (obj) => {
  const payload = JSON.stringify(obj)
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect()
    const off = on('_open', () => { off(); try { ws.send(payload); tap('out', obj, payload.length) } catch {} })
    return false
  }
  try { ws.send(payload); tap('out', obj, payload.length); return true } catch { return false }
}

const on = (type, cb) => {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type).add(cb)
  return () => off(type, cb)
}

const off = (type, cb) => {
  listeners.get(type)?.delete(cb)
}

export function useWs() {
  connect()
  const subs = []
  const sub = (type, cb) => {
    const u = on(type, cb)
    subs.push(u)
    return u
  }
  onUnmounted(() => { for (const u of subs) u() })
  return { send, on: sub, status }
}

// 给非 Vue 模块用的裸 API
export const wsSend = send
export const wsOn   = on

// 调试钩子:订阅所有进/出帧,返回取消函数
export const wsTap = (cb) => {
  taps.add(cb)
  return () => taps.delete(cb)
}
