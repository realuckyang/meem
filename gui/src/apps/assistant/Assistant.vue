<template>
  <!-- 整页固定为 视口 - 顶栏(44px) 的高度,内部 flex-col,中间 flex-1 滚动 -->
  <div class="flex flex-col h-[calc(100dvh-44px)]">
    <!-- 未配置提示 -->
    <div
      v-if="!aiReady && !checkingSettings"
      class="mx-4 mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 md:mx-8"
    >
      助理还没接好大模型。请到
      <router-link :to="{ name: 'settings' }" class="font-medium underline">设置</router-link>
      里填上 Base URL / API Key / Model。
    </div>

    <!-- 消息列表 -->
    <div
      ref="scrollEl"
      class="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-8 md:py-6"
      @scroll.passive="onScroll"
    >
      <div ref="contentEl" class="mx-auto max-w-3xl space-y-4">
        <!-- 顶部 sentinel:上滑触发加载更早 -->
        <div ref="topSentinelEl" class="py-2 text-center text-xs text-nt-soft">
          <span v-if="loadingOlder">加载更早…</span>
          <span v-else-if="!hasMoreHistory && turns.length">— 已经是最早 —</span>
        </div>

        <div v-if="loadingHistory && !turns.length" class="py-12 text-center text-sm text-nt-soft">加载中…</div>

        <div v-else-if="!turns.length && !streaming" class="py-12 text-center">
          <div class="text-4xl mb-2">🤖</div>
          <div class="text-sm text-nt-soft mb-4">问点什么 —— 我可以查你的数据库</div>
          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="s in suggestions"
              :key="s"
              type="button"
              class="rounded-full border border-nt-divider px-3 py-1 text-xs text-nt-muted hover:bg-nt-hover"
              @click="ask(s)"
            >{{ s }}</button>
          </div>
        </div>

        <template v-for="(item, i) in turns" :key="i">
          <!-- 用户气泡 -->
          <div v-if="item.kind === 'user'" class="flex justify-end">
            <div class="max-w-[85%] rounded-2xl rounded-br-sm bg-nt px-3.5 py-2.5 text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words">{{ item.content }}</div>
          </div>

          <!-- 工具调用块 -->
          <div v-else-if="item.kind === 'tool'" class="flex justify-start">
            <details class="max-w-[90%] flex-1 rounded-md border border-nt-divider bg-nt-hover/50 overflow-hidden" :open="item.open ?? false">
              <summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-nt-muted hover:bg-nt-hover">
                <span class="font-medium text-nt">{{ item.name }}</span>
                <span v-if="item.reason" class="truncate text-nt-soft">· {{ item.reason }}</span>
                <span v-if="item.status === 'running'" class="ml-auto inline-flex items-center gap-1 text-nt-soft">
                  <svg class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  执行中
                </span>
                <span v-else-if="item.status === 'error'" class="ml-auto text-nt-danger">失败</span>
                <span v-else class="ml-auto text-nt-soft">完成</span>
              </summary>
              <div class="border-t border-nt-divider bg-white px-3 py-2 space-y-2">
                <div v-if="item.args">
                  <div class="text-[11px] text-nt-soft mb-1">参数</div>
                  <pre class="overflow-x-auto rounded bg-nt-hover px-2 py-1.5 font-mono text-[12px] leading-relaxed text-nt whitespace-pre-wrap break-words">{{ item.args }}</pre>
                </div>
                <div v-if="item.result !== undefined">
                  <div class="text-[11px] text-nt-soft mb-1">结果</div>
                  <pre class="overflow-x-auto rounded bg-nt-hover px-2 py-1.5 font-mono text-[12px] leading-relaxed text-nt whitespace-pre-wrap break-words">{{ item.result }}</pre>
                </div>
              </div>
            </details>
          </div>

          <!-- 助手气泡(markdown 渲染) -->
          <div v-else-if="item.kind === 'assistant'" class="flex justify-start">
            <div class="md max-w-[85%] rounded-2xl rounded-bl-sm bg-nt-hover px-3.5 py-2.5 text-[15px] leading-relaxed text-nt break-words">
              <div v-html="renderMd(item.content)"></div><span v-if="item.streaming" class="ml-0.5 inline-block h-4 w-1.5 align-middle bg-nt-soft animate-pulse"></span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="shrink-0 border-t border-nt-divider bg-white px-3 py-3 md:px-8">
      <div class="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref="inputEl"
          v-model="draft"
          rows="1"
          :placeholder="aiReady ? '问点什么…  (Enter 发送,Shift+Enter 换行)' : '先去设置里配置大模型'"
          :disabled="!aiReady || streaming"
          class="max-h-32 flex-1 resize-none rounded-2xl bg-nt-hover px-3 py-2.5 text-[15px] text-nt outline-none placeholder:text-nt-hint disabled:opacity-60"
          @keydown="onKeydown"
          @input="autosize"
        ></textarea>
        <button
          type="button"
          :disabled="!aiReady || streaming || !draft.trim()"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nt text-white transition active:scale-95 disabled:bg-nt-hover-strong disabled:text-nt-soft"
          @click="ask()"
        >
          <svg v-if="!streaming" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          <svg v-else class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </button>
      </div>
    </div>

    <!-- WS 调试浮窗 -->
    <button
      type="button"
      class="fixed bottom-3 right-3 z-30 rounded-full border border-nt-divider bg-white px-2.5 py-1 text-[11px] text-nt-soft shadow-sm hover:bg-nt-hover hover:text-nt"
      :title="debugOpen ? '关闭调试' : '打开 WS 调试'"
      @click="toggleDebug"
    >{{ debugOpen ? '×' : '⌁' }} ws</button>

    <div
      v-if="debugOpen"
      class="fixed bottom-12 right-3 z-30 flex h-[60vh] w-[420px] max-w-[92vw] flex-col rounded-md border border-nt-divider bg-white shadow-lg"
    >
      <div class="flex items-center gap-2 border-b border-nt-divider px-2 py-1.5 text-xs">
        <span class="font-medium text-nt">WS 帧 · {{ debugLog.length }}</span>
        <span class="ml-2 text-nt-soft tabular-nums">最慢间隔 {{ debugMaxGap.toFixed(0) }} ms</span>
        <button
          type="button"
          class="ml-auto rounded px-1.5 py-0.5 text-nt-soft hover:bg-nt-hover hover:text-nt"
          @click="clearDebug"
        >清空</button>
        <label class="inline-flex items-center gap-1 text-nt-soft">
          <input type="checkbox" v-model="debugAutoScroll" class="accent-nt-accent" />
          跟随
        </label>
      </div>
      <div ref="debugListEl" class="flex-1 overflow-y-auto px-2 py-1 font-mono text-[11px] leading-snug">
        <div v-for="(r, i) in debugLog" :key="i" class="flex items-baseline gap-1.5">
          <span
            class="w-12 shrink-0 tabular-nums text-right"
            :class="r.gap > 200 ? 'text-nt-danger font-semibold' : r.gap > 80 ? 'text-amber-600' : 'text-nt-hint'"
          >+{{ r.gap.toFixed(0) }}</span>
          <span :class="r.dir === 'in' ? 'text-emerald-600' : 'text-sky-600'">{{ r.dir === 'in' ? '⇣' : '⇡' }}</span>
          <span class="shrink-0 text-nt">{{ r.type }}</span>
          <span v-if="r.preview" class="truncate text-nt-soft">{{ r.preview }}</span>
          <span class="ml-auto shrink-0 text-nt-hint tabular-nums">{{ r.bytes }}B</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { apiChat, apiSettings } from '@/api/client'
import { useWs, wsTap } from '@/composables/useWs'

const ws = useWs()

marked.setOptions({ breaks: true, gfm: true })
function renderMd(text) {
  if (!text) return ''
  const html = marked.parse(String(text))
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
}

const suggestions = [
  '我的想法里有多少条带 idea 标签的?',
  '最近一周新建了几条 memo?',
  '统计每个笔记本下的笔记数量',
]

// turns 是面向 UI 的渲染数组(扁平):
// { kind: 'user', content }
// { kind: 'assistant', content, streaming? }
// { kind: 'tool', id, name, args, reason, result, status: 'running'|'done'|'error', open }
const turns = ref([])
const toolMap = new Map() // tool_call_id → turn object 引用(prepend 时引用不变)

const draft     = ref('')
const streaming = ref(false)
const loadingHistory = ref(true)

const checkingSettings = ref(true)
const aiReady = ref(false)

const scrollEl       = ref(null)
const contentEl      = ref(null)
const topSentinelEl  = ref(null)
const inputEl  = ref(null)

// 回车发送;Shift+Enter 换行;中文输入法上屏时(isComposing / keyCode 229)放行,不触发发送
function onKeydown(e) {
  if (e.key !== 'Enter') return
  if (e.shiftKey) return
  if (e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  ask()
}

function autosize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

// 智能滚动:
// - ResizeObserver 监听内容容器,长高时若 stickToBottom 就 snap
// - stickToBottom 只在"用户主动上滑"时翻 false;布局变化引发的 scroll 事件不影响
const SCROLL_THRESHOLD = 80
const stickToBottom = ref(true)
let resizeObserver = null
let topObserver    = null
// 上次"用户视角"的 scrollTop,用于判断方向;程序性 scroll 会同步更新这个值
let lastScrollTop  = 0

function onScroll(e) {
  const el = e.target
  const newTop = el.scrollTop
  // scrollTop 没动 = 仅 scrollHeight 变,布局抖动,不动 stickToBottom
  if (newTop === lastScrollTop) return
  const goingUp = newTop < lastScrollTop
  lastScrollTop = newTop
  if (goingUp) {
    stickToBottom.value = false
  } else {
    // 向下滑;只要接近底部就再开启粘底
    const distance = el.scrollHeight - newTop - el.clientHeight
    if (distance < SCROLL_THRESHOLD) stickToBottom.value = true
  }
}

function snapToBottom() {
  const el = scrollEl.value
  if (!el) return
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 1) return
  el.scrollTop = el.scrollHeight
  lastScrollTop = el.scrollTop  // 自己滚的同步记下来,不会被 onScroll 误判
}

// 兼容旧调用:force=true 强制粘底并连续 snap 几次,扛住后续异步渲染(markdown/图)
function scrollBottom(force = false) {
  if (!force) return
  stickToBottom.value = true
  nextTick(() => {
    snapToBottom()
    requestAnimationFrame(() => {
      snapToBottom()
      setTimeout(snapToBottom, 120)
    })
  })
}

async function checkAi() {
  checkingSettings.value = true
  try {
    const { settings } = await apiSettings.detail()
    aiReady.value = !!(settings.ai_base_url && settings.ai_model && settings.ai_api_key)
  } catch {
    aiReady.value = false
  } finally {
    checkingSettings.value = false
  }
}

// 从历史 messages 表回放;dest 用于决定推到 turns 末尾还是临时数组(prepend 时)
function pushFromMessage(msg, dest) {
  const out = dest || turns.value
  if (!msg || !msg.role) return
  if (msg.role === 'user') {
    out.push({ kind: 'user', content: String(msg.content || '') })
  } else if (msg.role === 'assistant') {
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
      if (msg.content) out.push({ kind: 'assistant', content: String(msg.content) })
      for (const tc of msg.tool_calls) {
        let argsObj = {}
        try { argsObj = JSON.parse(tc.function?.arguments || '{}') } catch {}
        const turn = {
          kind: 'tool',
          id: tc.id,
          name: tc.function?.name || 'tool',
          args: formatArgs(argsObj),
          reason: argsObj.reason || '',
          result: undefined,
          status: 'done',
          open: false,
        }
        out.push(turn)
        toolMap.set(tc.id, turn)
      }
    } else {
      out.push({ kind: 'assistant', content: String(msg.content || '') })
    }
  } else if (msg.role === 'tool') {
    const turn = toolMap.get(msg.tool_call_id)
    if (turn) {
      turn.result = msg.content
      turn.status = 'done'
    }
  }
}

function formatArgs(obj) {
  // shell 直接显示 command,其它工具显示 JSON
  if (obj?.command) return String(obj.command)
  if (obj?.sql)     return String(obj.sql)
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}

// 分页加载历史:初次拿最新 30 条;上滑触发更早 30 条
const PAGE_SIZE = 30
const oldestId       = ref(0)
const hasMoreHistory = ref(true)
const loadingOlder   = ref(false)

async function loadInitial() {
  loadingHistory.value = true
  try {
    const { messages: rows } = await apiChat.messages({ limit: PAGE_SIZE })
    if (rows.length) {
      oldestId.value = rows[0].id
      for (const r of rows) pushFromMessage(r.message)
    }
    if (rows.length < PAGE_SIZE) hasMoreHistory.value = false
    // 首次:多次 snap,扛住 markdown / 工具卡片 / 图片 异步渲染
    scrollBottom(true)
  } catch {} finally {
    loadingHistory.value = false
  }
}

async function loadOlder() {
  if (loadingOlder.value || !hasMoreHistory.value || !oldestId.value) return
  loadingOlder.value = true
  const el = scrollEl.value
  const prevHeight = el?.scrollHeight || 0
  const prevTop    = el?.scrollTop || 0
  try {
    const { messages: rows } = await apiChat.messages({ before: oldestId.value, limit: PAGE_SIZE })
    if (rows.length) {
      oldestId.value = rows[0].id
      const prepend = []
      for (const r of rows) pushFromMessage(r.message, prepend)
      turns.value = [...prepend, ...turns.value]
    }
    if (rows.length < PAGE_SIZE) hasMoreHistory.value = false
    // 维持可视位置:上方插入新内容后,scrollTop += (新高 - 旧高)
    await nextTick()
    if (el) {
      // 等一帧让 ResizeObserver 不抢先
      requestAnimationFrame(() => {
        const newHeight = el.scrollHeight
        const top = prevTop + (newHeight - prevHeight)
        el.scrollTop = top
        lastScrollTop = el.scrollTop
      })
    }
  } catch {} finally {
    loadingOlder.value = false
  }
}

// 当前正在 streaming 的 assistant bubble(模块级,被 ws 各事件共享)
let currentAssistant = null
function ensureAssistant() {
  if (currentAssistant && turns.value.includes(currentAssistant)) return currentAssistant
  currentAssistant = { kind: 'assistant', content: '', streaming: true }
  turns.value.push(currentAssistant)
  return currentAssistant
}

async function ask(preset) {
  const content = (preset ?? draft.value).trim()
  if (!content || streaming.value || !aiReady.value) return

  turns.value.push({ kind: 'user', content })
  draft.value = ''
  if (inputEl.value) inputEl.value.style.height = 'auto'

  streaming.value = true
  stickToBottom.value = true
  scrollBottom(true)

  ws.send({ type: 'chat.send', content })
}

onMounted(async () => {
  // 监听内容容器尺寸变化,触发自动跟随
  if (contentEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (stickToBottom.value) snapToBottom()
    })
    resizeObserver.observe(contentEl.value)
  }

  // === WS:订阅 chat.* 事件 ===
  ws.on('chat.delta', (msg) => {
    const a = ensureAssistant()
    a.content += msg.delta || ''
  })
  ws.on('chat.assistant_tool_calls', (msg) => {
    if (currentAssistant) currentAssistant.streaming = false
    currentAssistant = null
    for (const tc of msg.message?.tool_calls || []) {
      let argsObj = {}
      try { argsObj = JSON.parse(tc.function?.arguments || '{}') } catch {}
      const turn = {
        kind: 'tool',
        id: tc.id,
        name: tc.function?.name || 'tool',
        args: formatArgs(argsObj),
        reason: argsObj.reason || '',
        result: undefined,
        status: 'running',
        open: false,
      }
      turns.value.push(turn)
      toolMap.set(tc.id, turn)
    }
  })
  ws.on('chat.tool_result', (msg) => {
    const turn = toolMap.get(msg.message?.tool_call_id)
    if (turn) {
      turn.result = msg.message.content
      const isError = /^tool error:|^\[?error\]?:/i.test(String(msg.message.content || '').trim())
      turn.status = isError ? 'error' : 'done'
    }
  })
  ws.on('chat.done', () => {
    if (currentAssistant) currentAssistant.streaming = false
    currentAssistant = null
    streaming.value = false
  })
  ws.on('chat.error', (msg) => {
    const a = ensureAssistant()
    a.content += `\n[错误] ${msg.message || ''}`
    a.streaming = false
    currentAssistant = null
    streaming.value = false
  })
  ws.on('chat.aborted', () => {
    if (currentAssistant) currentAssistant.streaming = false
    currentAssistant = null
    streaming.value = false
  })

  await checkAi()
  await loadInitial()
  // 注意先加载完初始内容、scroll 到底之后,再装顶部 sentinel 观察器,
  // 避免初次渲染时 sentinel 就在视口里立刻触发分页
  await nextTick()
  if (topSentinelEl.value && typeof IntersectionObserver !== 'undefined') {
    topObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadOlder()
    }, { root: scrollEl.value, rootMargin: '120px 0px 0px 0px' })
    topObserver.observe(topSentinelEl.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect(); resizeObserver = null
  topObserver?.disconnect();    topObserver = null
  stopDebug?.()
})

// === WS 调试浮窗 ===
const debugOpen   = ref(false)
const debugLog    = ref([])          // [{ dir, type, gap, bytes, preview }]
const debugMaxGap = ref(0)
const debugAutoScroll = ref(true)
const debugListEl = ref(null)
const DEBUG_CAP   = 500
let lastFrameT = 0
let stopDebug  = null

const previewOf = (msg) => {
  if (!msg || typeof msg !== 'object') return ''
  if (typeof msg.content === 'string') return msg.content.slice(0, 60)
  if (msg.message?.content && typeof msg.message.content === 'string') return msg.message.content.slice(0, 60)
  if (msg.delta && typeof msg.delta === 'string') return msg.delta.slice(0, 60)
  if (msg.data && typeof msg.data === 'object') {
    if (typeof msg.data.delta === 'string') return msg.data.delta.slice(0, 60)
    if (typeof msg.data.text  === 'string') return msg.data.text.slice(0, 60)
  }
  return ''
}

const toggleDebug = () => {
  debugOpen.value = !debugOpen.value
  if (debugOpen.value && !stopDebug) {
    lastFrameT = performance.now()
    stopDebug = wsTap((evt) => {
      const gap = lastFrameT ? evt.t - lastFrameT : 0
      lastFrameT = evt.t
      if (gap > debugMaxGap.value) debugMaxGap.value = gap
      debugLog.value.push({
        dir: evt.dir,
        type: evt.type,
        gap,
        bytes: evt.bytes,
        preview: previewOf(evt.msg),
      })
      if (debugLog.value.length > DEBUG_CAP) debugLog.value.splice(0, debugLog.value.length - DEBUG_CAP)
      if (debugAutoScroll.value) {
        nextTick(() => {
          const el = debugListEl.value
          if (el) el.scrollTop = el.scrollHeight
        })
      }
    })
  }
}

const clearDebug = () => {
  debugLog.value = []
  debugMaxGap.value = 0
  lastFrameT = performance.now()
}
</script>
