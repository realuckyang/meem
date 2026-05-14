<template>
  <div class="flex flex-col h-[calc(100dvh-44px)]">
    <!-- 顶栏 -->
    <div class="shrink-0 border-b border-nt-divider bg-white px-3 py-2 md:px-8">
      <div class="mx-auto flex max-w-3xl items-center gap-2">
        <router-link
          :to="{ name: 'tasks' }"
          class="rounded p-1 text-nt-soft hover:bg-nt-hover hover:text-nt"
          title="返回列表"
        >←</router-link>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="truncate text-sm font-medium text-nt">{{ task?.title || `任务 #${id}` }}</span>
            <span v-if="task" class="shrink-0 rounded bg-nt-hover px-1.5 py-0.5 text-[10px] text-nt-soft">{{ task.app }}</span>
            <span v-if="task" class="shrink-0 rounded px-1.5 py-0.5 text-[10px]" :class="modeClass(task.mode)">{{ task.mode }}</span>
          </div>
          <div v-if="task" class="text-xs text-nt-soft">{{ fmtTime(task.created_at) }}<span v-if="task.finished_at"> → {{ fmtTime(task.finished_at) }}</span></div>
        </div>
        <span v-if="task" class="shrink-0 rounded-full px-2 py-0.5 text-[11px]" :class="statusClass(task.status)">{{ statusLabel(task.status) }}</span>
        <button
          v-if="task?.status === 'pending'"
          type="button"
          class="ml-2 shrink-0 rounded border border-nt-danger/40 px-2 py-1 text-xs text-nt-danger hover:bg-nt-danger/10"
          @click="onStop"
        >终止</button>
      </div>
    </div>

    <!-- 消息流 -->
    <div ref="scrollEl" class="relative flex-1 min-h-0 overflow-y-auto px-3 py-4 md:px-8 md:py-6">
      <div class="mx-auto max-w-3xl space-y-4">
        <div v-if="loading && !turns.length" class="py-12 text-center text-sm text-nt-soft">加载中…</div>
        <div v-else-if="error" class="rounded border border-nt-danger/30 bg-nt-danger/5 px-3 py-2 text-sm text-nt-danger">{{ error }}</div>
        <div v-else-if="!turns.length" class="py-12 text-center text-sm text-nt-soft">暂无消息</div>

        <template v-for="(item, i) in turns" :key="i">
          <div v-if="item.kind === 'user'" class="flex justify-end">
            <div class="max-w-[85%] rounded-2xl rounded-br-sm bg-nt px-3.5 py-2.5 text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words">{{ item.content }}</div>
          </div>
          <div v-else-if="item.kind === 'tool'" class="flex justify-start">
            <details class="max-w-[90%] flex-1 rounded-md border border-nt-divider bg-nt-hover/50 overflow-hidden">
              <summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-nt-muted hover:bg-nt-hover">
                <span class="font-medium text-nt">{{ item.name }}</span>
                <span v-if="item.reason" class="truncate text-nt-soft">· {{ item.reason }}</span>
                <span class="ml-auto text-nt-soft">{{ item.result !== undefined ? '完成' : '执行中' }}</span>
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
          <div v-else-if="item.kind === 'assistant'" class="flex justify-start">
            <div class="md max-w-[85%] rounded-2xl rounded-bl-sm bg-nt-hover px-3.5 py-2.5 text-[15px] leading-relaxed text-nt break-words">
              <div v-html="renderMd(item.content)"></div>
            </div>
          </div>
        </template>

        <div v-if="task?.error" class="rounded border border-nt-danger/30 bg-nt-danger/5 px-3 py-2 text-sm text-nt-danger whitespace-pre-wrap">{{ task.error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { marked } from 'marked'
import { apiTask } from '@/api/client'
import { useWs } from '@/composables/useWs'

const props = defineProps({ id: { type: [String, Number], required: true } })
const ws = useWs()

marked.setOptions({ breaks: true, gfm: true })
const renderMd = (text) => marked.parse(String(text || ''))

const task    = ref(null)
const turns   = ref([])
const loading = ref(true)
const error   = ref('')
const scrollEl = ref(null)

// 同 Assistant 的拼装逻辑:把原始 messages 行展平成扁平 turns。
// tool_call_id → tool turn 引用,后续 tool 角色的消息能回填到对应卡片。
const toolMap = new Map()

const reset = () => {
  turns.value = []
  toolMap.clear()
}

const pushFromMessage = (msg) => {
  if (!msg || !msg.role) return
  if (msg.role === 'user') {
    turns.value.push({ kind: 'user', content: String(msg.content || '') })
  } else if (msg.role === 'assistant') {
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
      if (msg.content) turns.value.push({ kind: 'assistant', content: String(msg.content) })
      for (const tc of msg.tool_calls) {
        let argsObj = {}
        try { argsObj = JSON.parse(tc.function?.arguments || '{}') } catch {}
        const turn = reactive({
          kind: 'tool', id: tc.id,
          name: tc.function?.name || 'tool',
          args: argsObj.command || argsObj.sql || (() => { try { return JSON.stringify(argsObj, null, 2) } catch { return '' } })(),
          reason: argsObj.reason || '',
          result: undefined,
        })
        turns.value.push(turn)
        toolMap.set(tc.id, turn)
      }
    } else {
      turns.value.push({ kind: 'assistant', content: String(msg.content || '') })
    }
  } else if (msg.role === 'tool') {
    const turn = toolMap.get(msg.tool_call_id)
    if (turn) turn.result = msg.content
  }
}

const refresh = async () => {
  try {
    const { task: t } = await apiTask.detail(props.id)
    task.value = t
    const { messages: rows } = await apiTask.messages(props.id)
    reset()
    for (const r of rows) pushFromMessage(r.message)
    await nextTick()
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const onStop = async () => {
  if (!confirm('终止这个任务?')) return
  try { await apiTask.stop(props.id) } catch (e) { alert(e.message) }
}

const modeClass = (m) => m === 'agent'
  ? 'bg-violet-50 text-violet-700'
  : 'bg-sky-50 text-sky-700'
const statusLabel = (s) => ({ pending: '运行中', done: '完成', error: '失败', aborted: '已终止' }[s] || s)
const statusClass = (s) => ({
  pending: 'bg-amber-50 text-amber-700',
  done:    'bg-emerald-50 text-emerald-700',
  error:   'bg-nt-danger/10 text-nt-danger',
  aborted: 'bg-nt-hover text-nt-soft',
}[s] || 'bg-nt-hover text-nt-soft')
const fmtTime = (s) => {
  if (!s) return ''
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return s
  const Y = d.getFullYear(), M = String(d.getMonth()+1).padStart(2,'0'), D = String(d.getDate()).padStart(2,'0')
  const h = String(d.getHours()).padStart(2,'0'), m = String(d.getMinutes()).padStart(2,'0')
  return `${Y}/${M}/${D} ${h}:${m}`
}

// 路由切换到不同 task 时刷新
watch(() => props.id, () => { loading.value = true; refresh() })

const offs = []
onMounted(() => {
  refresh()
  // 状态变化(包括 finish/error/aborted) → 重拉一次
  offs.push(ws.on('tasks_changed', (msg) => {
    if (!msg.taskId || Number(msg.taskId) === Number(props.id)) refresh()
  }))
  // 单条消息增量 → 也用 refresh 简单可靠(消息条数 = O(几十),不算开销)
  offs.push(ws.on('task_message_added', (msg) => {
    if (Number(msg.taskId) === Number(props.id)) refresh()
  }))
})
onUnmounted(() => { for (const o of offs) o?.() })
</script>
