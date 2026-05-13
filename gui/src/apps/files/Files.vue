<template>
  <div class="min-h-screen">
    <main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-20 md:px-12 md:pt-10">
      <h1 class="text-3xl md:text-[40px] font-bold leading-tight tracking-tight text-nt">文件</h1>

      <!-- 路径面包屑 -->
      <div class="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar text-sm">
        <button
          type="button"
          class="shrink-0 rounded px-1.5 py-1 text-nt-soft hover:bg-nt-hover hover:text-nt"
          title="主目录"
          @click="goHome"
        >🏠</button>
        <span class="shrink-0 text-nt-hint">/</span>
        <template v-for="(seg, i) in segments" :key="i">
          <button
            type="button"
            class="shrink-0 rounded px-1.5 py-1 text-nt hover:bg-nt-hover"
            @click="goSegment(i)"
          >{{ seg }}</button>
          <span v-if="i < segments.length - 1" class="shrink-0 text-nt-hint">/</span>
        </template>
      </div>

      <!-- 操作栏 -->
      <div class="mt-3 flex items-center gap-2 text-xs">
        <button
          type="button"
          class="rounded border border-nt-divider px-2 py-1 text-nt hover:bg-nt-hover"
          @click="onMkdir"
        >＋ 新建文件夹</button>
        <button
          type="button"
          class="rounded border border-nt-divider px-2 py-1 text-nt hover:bg-nt-hover"
          @click="refresh"
        >刷新</button>
        <label class="ml-auto inline-flex items-center gap-1.5 text-nt-soft">
          <input type="checkbox" v-model="showHidden" @change="refresh" class="accent-nt-accent" />
          显示隐藏
        </label>
      </div>

      <!-- 列表 -->
      <div v-if="error" class="mt-6 rounded border border-nt-danger/30 bg-nt-danger/5 px-3 py-2 text-sm text-nt-danger">{{ error }}</div>

      <div v-else-if="loading" class="mt-8 text-center text-sm text-nt-soft">加载中…</div>

      <div v-else-if="!entries.length" class="mt-8 text-center text-sm text-nt-soft">空目录</div>

      <ul v-else class="mt-4 divide-y divide-nt-divider rounded border border-nt-divider bg-white">
        <li
          v-if="cwd && parentPath"
          class="group flex items-center gap-2 px-3 py-2 text-sm hover:bg-nt-hover cursor-pointer"
          @click="cd(parentPath)"
        >
          <span class="text-base">↩︎</span>
          <span class="text-nt-soft">上一级</span>
        </li>
        <li
          v-for="e in entries"
          :key="e.name"
          class="group flex items-center gap-2 px-3 py-2 text-sm hover:bg-nt-hover"
          :class="e.type === 'dir' ? 'cursor-pointer' : ''"
          @click="onRowClick(e)"
        >
          <span class="text-base">{{ iconOf(e) }}</span>
          <span class="truncate text-nt" :class="e.type === 'dir' ? 'font-medium' : ''">{{ e.name }}</span>
          <span class="ml-auto shrink-0 text-xs text-nt-hint tabular-nums">
            <span v-if="e.type !== 'dir'">{{ fmtSize(e.size) }}</span>
            <span v-else>—</span>
          </span>
          <span class="shrink-0 text-xs text-nt-hint w-[140px] text-right tabular-nums hidden md:inline">
            {{ fmtTime(e.mtime) }}
          </span>
          <span class="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-nt-soft hover:bg-nt-hover-strong hover:text-nt"
              title="重命名"
              @click.stop="onRename(e)"
            >✎</button>
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-nt-soft hover:bg-nt-hover-strong hover:text-nt-danger"
              title="删除"
              @click.stop="onDelete(e)"
            >🗑</button>
          </span>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWs } from '@/composables/useWs'

const ws = useWs()

const cwd        = ref('')
const sep        = ref('/')
const entries    = ref([])
const showHidden = ref(false)
const loading    = ref(false)
const error      = ref('')

// reqId → resolver
const pending = new Map()
const nextId = (() => { let n = 0; return () => `fs-${Date.now()}-${++n}` })()

const call = (type, data = {}) => new Promise((resolve, reject) => {
  const reqId = nextId()
  pending.set(reqId, { resolve, reject })
  ws.send({ type, data: { ...data, reqId } })
  setTimeout(() => {
    if (pending.has(reqId)) {
      pending.delete(reqId)
      reject(new Error('请求超时'))
    }
  }, 15000)
})

ws.on('fs.result', (msg) => {
  const d = msg.data || {}
  const p = pending.get(d.reqId)
  if (!p) return
  pending.delete(d.reqId)
  if (d.ok) p.resolve(d)
  else p.reject(new Error(d.error || '操作失败'))
})

const segments = computed(() => {
  if (!cwd.value) return []
  const s = sep.value
  const parts = cwd.value.split(s).filter(Boolean)
  return s === '/' ? parts : parts
})

const parentPath = computed(() => {
  const s = sep.value
  if (!cwd.value) return ''
  const idx = cwd.value.lastIndexOf(s)
  if (idx <= 0) return s
  return cwd.value.slice(0, idx)
})

const goSegment = async (i) => {
  const s = sep.value
  const parts = cwd.value.split(s).filter(Boolean)
  const isUnix = s === '/'
  const next = isUnix ? '/' + parts.slice(0, i + 1).join('/') : parts.slice(0, i + 1).join(s)
  await cd(next)
}

const goHome = async () => {
  try {
    const r = await call('fs.home')
    sep.value = r.sep || '/'
    await cd(r.path)
  } catch (e) {
    error.value = e.message
  }
}

const cd = async (p) => {
  loading.value = true
  error.value = ''
  try {
    const r = await call('fs.list', { path: p, showHidden: showHidden.value })
    cwd.value = r.path
    entries.value = r.entries || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const refresh = () => cwd.value && cd(cwd.value)

const onRowClick = (e) => {
  if (e.type === 'dir') cd(joinPath(cwd.value, e.name))
}

const onMkdir = async () => {
  const name = prompt('新建文件夹名称')
  if (!name) return
  try {
    await call('fs.mkdir', { path: joinPath(cwd.value, name) })
    refresh()
  } catch (e) {
    alert(e.message)
  }
}

const onRename = async (e) => {
  const next = prompt('重命名', e.name)
  if (!next || next === e.name) return
  try {
    await call('fs.rename', {
      from: joinPath(cwd.value, e.name),
      to:   joinPath(cwd.value, next),
    })
    refresh()
  } catch (err) {
    alert(err.message)
  }
}

const onDelete = async (e) => {
  if (!confirm(`确认删除 "${e.name}"？${e.type === 'dir' ? '(包含其中所有内容)' : ''}`)) return
  try {
    await call('fs.delete', { path: joinPath(cwd.value, e.name), recursive: e.type === 'dir' })
    refresh()
  } catch (err) {
    alert(err.message)
  }
}

const joinPath = (base, name) => {
  const s = sep.value
  if (!base) return name
  if (base.endsWith(s)) return base + name
  return base + s + name
}

const iconOf = (e) => {
  if (e.type === 'dir')  return '📁'
  if (e.type === 'link') return '🔗'
  return '📄'
}

const fmtSize = (n) => {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const fmtTime = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${y}/${M}/${D} ${h}:${m}`
}

onMounted(() => {
  ws.on('_open', goHome)
  goHome()
})
</script>
