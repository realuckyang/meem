<template>
  <div class="min-h-screen">
    <main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-20 md:px-12 md:pt-10">
      <div class="flex items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl md:text-[40px] font-bold leading-tight tracking-tight text-nt">记忆</h1>
          <p class="mt-1 text-sm text-nt-soft">写给助理看的长期上下文,启用的条目会进系统提示。</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md bg-nt px-3 py-1.5 text-sm text-white hover:bg-nt-strong"
          @click="newDraft"
        >＋ 新记忆</button>
      </div>

      <div v-if="error" class="mt-6 rounded border border-nt-danger/30 bg-nt-danger/5 px-3 py-2 text-sm text-nt-danger">{{ error }}</div>

      <div v-if="loading && !items.length" class="mt-10 text-center text-sm text-nt-soft">加载中…</div>

      <div v-else-if="!items.length && !draft" class="mt-10 text-center text-sm text-nt-soft">
        还没有记忆 —— 点右上角「新记忆」加一条。
      </div>

      <ul v-else class="mt-6 space-y-3">
        <!-- 新建草稿固定在顶 -->
        <li
          v-if="draft"
          class="rounded-md border border-nt-accent/40 bg-white px-4 py-3"
        >
          <MemoryEditor
            :model-value="draft"
            @save="onCreate"
            @cancel="draft = null"
          />
        </li>

        <li
          v-for="m in items"
          :key="m.id"
          class="rounded-md border border-nt-divider bg-white px-4 py-3"
          :class="m.enabled ? '' : 'opacity-60'"
        >
          <!-- 编辑态 -->
          <MemoryEditor
            v-if="editingId === m.id"
            :model-value="editing"
            :is-edit="true"
            @save="onUpdate"
            @cancel="editingId = 0; editing = null"
            @delete="onDelete(m.id)"
          />
          <!-- 浏览态 -->
          <div v-else @click="beginEdit(m)" class="cursor-pointer">
            <div class="flex items-center gap-2">
              <span v-if="m.pinned" class="text-amber-500" title="置顶">📌</span>
              <span class="truncate font-medium text-nt">{{ m.title || '无标题' }}</span>
              <span
                class="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                :class="m.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-nt-hover text-nt-soft'"
              >{{ m.enabled ? '启用' : '关闭' }}</span>
            </div>
            <p v-if="m.description" class="mt-1 truncate text-sm text-nt-soft">{{ m.description }}</p>
            <p v-else-if="m.content" class="mt-1 truncate text-sm text-nt-soft">{{ m.content.slice(0, 120) }}</p>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiMemory } from '@/api/client'
import MemoryEditor from './MemoryEditor.vue'

const items     = ref([])
const loading   = ref(true)
const error     = ref('')
const draft     = ref(null)
const editingId = ref(0)
const editing   = ref(null)

const refresh = async () => {
  loading.value = true
  error.value = ''
  try {
    const { items: rows } = await apiMemory.list()
    items.value = rows || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const newDraft = () => {
  draft.value = { title: '', description: '', content: '', enabled: true, pinned: false }
}

const beginEdit = (m) => {
  editingId.value = m.id
  editing.value = { ...m }
}

const onCreate = async (patch) => {
  try {
    await apiMemory.create(patch)
    draft.value = null
    await refresh()
  } catch (e) {
    alert(e.message)
  }
}

const onUpdate = async (patch) => {
  try {
    await apiMemory.update(editingId.value, patch)
    editingId.value = 0
    editing.value = null
    await refresh()
  } catch (e) {
    alert(e.message)
  }
}

const onDelete = async (id) => {
  if (!confirm('删除这条记忆?')) return
  try {
    await apiMemory.remove(id)
    editingId.value = 0
    editing.value = null
    await refresh()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(refresh)
</script>
