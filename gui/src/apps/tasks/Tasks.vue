<template>
  <div class="min-h-screen">
    <main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-20 md:px-12 md:pt-10">
      <div class="flex items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl md:text-[40px] font-bold leading-tight tracking-tight text-nt">任务</h1>
          <p class="mt-1 text-sm text-nt-soft">应用提交给助理的后台任务,实时更新。</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded border border-nt-divider px-2.5 py-1 text-sm text-nt hover:bg-nt-hover"
          @click="refresh"
        >刷新</button>
      </div>

      <div v-if="error" class="mt-6 rounded border border-nt-danger/30 bg-nt-danger/5 px-3 py-2 text-sm text-nt-danger">{{ error }}</div>

      <div v-else-if="loading && !tasks.length" class="mt-10 text-center text-sm text-nt-soft">加载中…</div>

      <div v-else-if="!tasks.length" class="mt-10 text-center text-sm text-nt-soft">
        还没有任务 —— 应用会在后台调用助理时自动创建。
      </div>

      <ul v-else class="mt-6 divide-y divide-nt-divider rounded border border-nt-divider bg-white">
        <li
          v-for="t in tasks"
          :key="t.id"
          class="flex items-center gap-3 px-3 py-2.5 hover:bg-nt-hover cursor-pointer"
          @click="open(t.id)"
        >
          <span class="text-base">{{ iconOf(t) }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-sm font-medium text-nt">{{ t.title || `任务 #${t.id}` }}</span>
              <span class="shrink-0 rounded bg-nt-hover px-1.5 py-0.5 text-[10px] text-nt-soft">{{ t.app }}</span>
              <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px]" :class="modeClass(t.mode)">{{ t.mode }}</span>
            </div>
            <div class="mt-0.5 text-xs text-nt-soft">{{ fmtTime(t.created_at) }}</div>
          </div>
          <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px]" :class="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiTask } from '@/api/client'
import { useWs } from '@/composables/useWs'

const router = useRouter()
const ws = useWs()

const tasks   = ref([])
const loading = ref(true)
const error   = ref('')

const refresh = async () => {
  loading.value = true
  error.value = ''
  try {
    tasks.value = await apiTask.list({ limit: 50 })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const open = (id) => router.push({ name: 'task', params: { id } })

const iconOf = (t) => t.mode === 'agent' ? '🤖' : '⚡'

const modeClass = (m) => m === 'agent'
  ? 'bg-violet-50 text-violet-700'
  : 'bg-sky-50 text-sky-700'

const statusLabel = (s) => ({
  pending: '运行中', done: '完成', error: '失败', aborted: '已终止',
}[s] || s)

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

let off = null
onMounted(() => {
  refresh()
  off = ws.on('tasks_changed', () => refresh())
})
onUnmounted(() => { off?.() })
</script>
