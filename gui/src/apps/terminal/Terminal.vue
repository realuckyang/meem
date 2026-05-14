<template>
  <div class="flex flex-col h-[calc(100dvh-44px)]">
    <!-- 标签栏 -->
    <div class="flex items-center gap-1 border-b border-nt-divider bg-white px-3 py-1.5 overflow-x-auto no-scrollbar">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        :class="[
          'group flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs transition',
          t.id === activeId ? 'bg-nt-hover-strong text-nt' : 'text-nt-muted hover:bg-nt-hover hover:text-nt',
        ]"
        @click="pickTab(t.id)"
      >
        <span class="text-[13px] leading-none">▶</span>
        <span class="max-w-[140px] truncate">{{ t.title || t.id }}</span>
        <span
          class="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-nt-soft hover:bg-nt-hover-strong hover:text-nt-danger md:h-4 md:w-4"
          aria-label="关闭终端"
          title="关闭"
          @click.stop="closeTab(t.id)"
        >✕</span>
      </button>
      <button
        type="button"
        class="shrink-0 rounded px-2 py-1 text-xs text-nt-soft hover:bg-nt-hover hover:text-nt"
        title="新终端"
        @click="addTab"
      >＋</button>
      <div class="ml-auto text-xs text-nt-soft px-2" v-if="connected">{{ tabs.length }} 个终端</div>
    </div>

    <!-- xterm 容器(深色,占满剩余) -->
    <div class="relative flex-1 min-h-0 bg-[#1e1e1e]">
      <div ref="hostEl" class="absolute inset-0 px-2 pt-2"></div>
      <div
        v-if="!tabs.length"
        class="absolute inset-0 flex items-center justify-center text-sm text-nt-soft"
      >连接中…</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Terminal as Xterm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useWs } from '@/composables/useWs'

const ws = useWs()

const tabs     = ref([])         // [{ id, title, isActive }]
const activeId = ref('')
const hostEl   = ref(null)
const connected = ref(false)

// 每个 terminal 一个 xterm 实例 + fit;buf 暂存 mount 前到达的输出
const insts = new Map()
const buf   = new Map()

const TERM_THEME = {
  background: '#1e1e1e', foreground: '#e8eaed',
  cursor: '#34a853', cursorAccent: '#1e1e1e',
  selectionBackground: '#3a3a3a',
  black: '#1e1e1e', red: '#f28b82', green: '#34a853', yellow: '#fbbc04',
  blue: '#5e97ff', magenta: '#c58af9', cyan: '#78d4fa', white: '#e8eaed',
  brightBlack: '#5f6368', brightRed: '#ff7a72', brightGreen: '#5dca80',
  brightYellow: '#fde293', brightBlue: '#8ab4f8', brightMagenta: '#d7aefb',
  brightCyan: '#a1f0fa', brightWhite: '#ffffff',
}

const getOrCreate = (id) => {
  if (insts.has(id)) return insts.get(id)
  const term = new Xterm({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'JetBrains Mono, ui-monospace, Menlo, Monaco, Consolas, monospace',
    scrollback: 5000,
    theme: TERM_THEME,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.onData((data) => {
    if (id !== activeId.value) return
    ws.send({ type: 'data.input', data: { terminalId: id, input: data } })
  })
  insts.set(id, { term, fit })
  return insts.get(id)
}

const flushBuf = (id) => {
  const pending = buf.get(id)
  if (!pending) return
  const inst = insts.get(id)
  if (!inst) return
  inst.term.write(pending)
  buf.delete(id)
}

const mountActive = () => {
  const id = activeId.value
  if (!id || !hostEl.value) return
  for (const [tid, { term }] of insts.entries()) {
    if (term.element) term.element.style.display = (tid === id) ? '' : 'none'
  }
  const inst = getOrCreate(id)
  if (!inst.term.element) inst.term.open(hostEl.value)
  flushBuf(id)
  setTimeout(() => { try { inst.fit.fit(); sendResize(id) } catch {} }, 0)
}

const write = (id, output) => {
  if (!id || !output) return
  const inst = insts.get(id)
  if (inst?.term.element) inst.term.write(output)
  else buf.set(id, (buf.get(id) || '') + output)
}

const sendResize = (id = activeId.value) => {
  const inst = insts.get(id)
  if (!inst) return
  const cols = inst.term.cols
  const rows = inst.term.rows
  if (cols && rows) ws.send({ type: 'system.resize', data: { terminalId: id, cols, rows } })
}

const refreshList = () => ws.send({ type: 'terminal.list', data: {} })
const addTab      = () => ws.send({ type: 'terminal.create', data: {} })
const closeTab    = (id) => ws.send({ type: 'terminal.close', data: { terminalId: id } })
const pickTab = (id) => {
  if (!id || id === activeId.value) return
  ws.send({ type: 'terminal.activate', data: { terminalId: id } })
}

const setTabs = (items, preferredId) => {
  const list = items || []
  tabs.value = list
  // dispose 已经不在的
  const keep = new Set(list.map(t => t.id))
  for (const tid of [...insts.keys()]) {
    if (!keep.has(tid)) {
      insts.get(tid)?.term.dispose()
      insts.delete(tid)
      buf.delete(tid)
    }
  }
  const fallback = preferredId || list.find(t => t.isActive)?.id || list[0]?.id || ''
  if (fallback) {
    activeId.value = fallback
    setTimeout(mountActive, 0)
  }
}

onMounted(() => {
  ws.on('_open', () => { connected.value = true; refreshList() })
  ws.on('terminal.list', (msg) => setTabs(msg.data?.terminals || [], msg.data?.activeTerminalId))
  ws.on('terminal.created', (msg) => {
    const t = msg.data?.terminal
    if (!t?.id) return
    const next = [...tabs.value.filter(x => x.id !== t.id), t]
    setTabs(next, msg.data?.activeTerminalId || t.id)
  })
  ws.on('terminal.closed', (msg) => {
    setTabs(tabs.value.filter(x => x.id !== msg.data?.terminalId), msg.data?.activeTerminalId || '')
  })
  ws.on('terminal.activated', (msg) => {
    const id = msg.data?.terminalId
    if (!id) return
    activeId.value = id
    setTimeout(mountActive, 0)
  })
  ws.on('data.output', (msg) => write(msg.data?.terminalId, msg.data?.output))
  ws.on('system.init', (msg) => {
    const id = msg.data?.terminalId || activeId.value
    if (!id) return
    const inst = getOrCreate(id)
    if (msg.data?.cols && msg.data?.rows) inst.term.resize(msg.data.cols, msg.data.rows)
    if (id === activeId.value) inst.fit.fit()
  })
  // 首次挂载就拉一遍(可能 ws 已经 open)
  refreshList()
})

watch(activeId, () => setTimeout(mountActive, 0))

const onResize = () => {
  const id = activeId.value
  if (!id) return
  const inst = insts.get(id)
  if (!inst) return
  try { inst.fit.fit() } catch {}
  sendResize(id)
}
window.addEventListener('resize', onResize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  for (const { term } of insts.values()) term.dispose()
  insts.clear(); buf.clear()
})
</script>
