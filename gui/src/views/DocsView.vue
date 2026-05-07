<script setup>
import { computed, onMounted, ref, watch } from 'vue';

async function asJson(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
    }
    return res.json();
}

const cwdId = ref(null);
const cwd = ref(null);
const folders = ref([]);
const docs = ref([]);
const breadcrumb = ref([]);
const loading = ref(false);

const editing = ref(null);
const editorTitle = ref('');
const editorContent = ref('');
const dirty = ref(false);
let saveTimer = null;

const isEditing = computed(() => !!editing.value);

async function refresh() {
    loading.value = true;
    try {
        const id = cwdId.value;
        const [listRes, crumbRes] = await Promise.all([
            fetch(`/api/docs/list${id != null ? `?folderId=${id}` : ''}`).then(asJson),
            fetch(`/api/docs/breadcrumb${id != null ? `?folderId=${id}` : ''}`).then(asJson),
        ]);
        cwd.value = listRes.folder;
        folders.value = listRes.folders || [];
        docs.value = listRes.docs || [];
        breadcrumb.value = crumbRes || [];
    } finally {
        loading.value = false;
    }
}

async function navigate(folderId) {
    cwdId.value = folderId ?? null;
    await refresh();
}

async function createFolder() {
    const name = prompt('文件夹名称');
    if (!name) return;
    await fetch('/api/docs/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: cwdId.value, name }),
    }).then(asJson);
    await refresh();
}

async function renameFolder(f, e) {
    e.stopPropagation();
    const name = prompt('重命名文件夹', f.name);
    if (!name || name === f.name) return;
    await fetch(`/api/docs/folders/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    }).then(asJson);
    await refresh();
}

async function deleteFolder(f, e) {
    e.stopPropagation();
    if (!confirm(`删除文件夹 "${f.name}" 及其全部内容？`)) return;
    await fetch(`/api/docs/folders/${f.id}`, { method: 'DELETE' }).then(asJson);
    await refresh();
}

async function createDoc() {
    const created = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: cwdId.value, title: '未命名' }),
    }).then(asJson);
    await refresh();
    await openDoc(created.id);
}

async function openDoc(id) {
    editing.value = await fetch(`/api/docs/${id}`).then(asJson);
}

async function deleteDoc(d, e) {
    e.stopPropagation();
    if (!confirm(`删除文档 "${d.title}"？`)) return;
    await fetch(`/api/docs/${d.id}`, { method: 'DELETE' }).then(asJson);
    if (editing.value?.id === d.id) editing.value = null;
    await refresh();
}

watch(() => editing.value?.id, (id) => {
    if (!id) return;
    editorTitle.value = editing.value.title;
    editorContent.value = editing.value.content;
    dirty.value = false;
});

function scheduleSave() {
    dirty.value = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 500);
}

async function flushSave() {
    if (!dirty.value || !editing.value) return;
    clearTimeout(saveTimer);
    const id = editing.value.id;
    const updated = await fetch(`/api/docs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editorTitle.value, content: editorContent.value }),
    }).then(asJson);
    editing.value = updated;
    const i = docs.value.findIndex((d) => d.id === id);
    if (i >= 0) docs.value[i] = { ...docs.value[i], title: updated.title, updated_at: updated.updated_at };
    dirty.value = false;
}

async function closeEditor() {
    await flushSave();
    editing.value = null;
}

function fmtTime(s) {
    if (!s) return '';
    const d = new Date(s.replace(' ', 'T') + 'Z');
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 30 * 86400000) return `${Math.floor(diff / 86400000)} 天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

onMounted(refresh);
</script>

<template>
    <div class="flex flex-col h-full bg-zinc-950 text-zinc-100 min-h-0">
        <div v-if="isEditing" class="flex flex-col flex-1 min-h-0">
            <div class="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
                <button @click="closeEditor"
                    class="px-2 py-1.5 rounded text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                    ← 返回
                </button>
                <span class="text-xs text-zinc-500 ml-auto">
                    <span v-if="dirty">保存中…</span>
                    <span v-else>已保存 · {{ fmtTime(editing.updated_at) }}</span>
                </span>
            </div>
            <input v-model="editorTitle" @input="scheduleSave" @blur="flushSave"
                placeholder="标题"
                class="shrink-0 px-4 pt-4 pb-2 bg-transparent text-[20px] font-semibold text-zinc-100 outline-none border-none placeholder-zinc-600" />
            <textarea v-model="editorContent" @input="scheduleSave" @blur="flushSave"
                placeholder="开始写..."
                class="flex-1 min-h-0 w-full px-4 pb-6 bg-transparent text-[15px] leading-relaxed text-zinc-200 outline-none resize-none placeholder-zinc-600"></textarea>
        </div>

        <div v-else class="flex flex-col flex-1 min-h-0">
            <div class="shrink-0 flex items-center gap-1 overflow-x-auto px-3 py-2 border-b border-zinc-800 bg-zinc-900/40 text-sm">
                <button @click="navigate(null)"
                    class="px-2 py-1 rounded text-zinc-300 hover:bg-zinc-800 shrink-0"
                    :class="cwdId === null ? 'text-zinc-100 font-medium' : ''">
                    根目录
                </button>
                <template v-for="(c, i) in breadcrumb" :key="c.id">
                    <span class="text-zinc-600 shrink-0">/</span>
                    <button @click="navigate(c.id)"
                        class="px-2 py-1 rounded hover:bg-zinc-800 shrink-0 max-w-[40vw] truncate"
                        :class="i === breadcrumb.length - 1 ? 'text-zinc-100 font-medium' : 'text-zinc-300'">
                        {{ c.name }}
                    </button>
                </template>
            </div>

            <div class="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                <button @click="createDoc"
                    class="px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-900 text-[13px] font-medium hover:opacity-90">
                    + 文档
                </button>
                <button @click="createFolder"
                    class="px-3 py-1.5 rounded-md border border-zinc-700 text-[13px] text-zinc-200 hover:bg-zinc-800">
                    + 文件夹
                </button>
                <span class="ml-auto text-xs text-zinc-500" v-if="loading">加载中…</span>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto">
                <ul class="divide-y divide-zinc-800/60">
                    <li v-for="f in folders" :key="'f' + f.id"
                        @click="navigate(f.id)"
                        class="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/60 cursor-pointer group">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400 shrink-0">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        <span class="flex-1 text-[15px] truncate">{{ f.name }}</span>
                        <button @click="renameFolder(f, $event)"
                            class="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 rounded">
                            重命名
                        </button>
                        <button @click="deleteFolder(f, $event)"
                            class="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-zinc-500 hover:text-rose-400 rounded">
                            删
                        </button>
                    </li>
                    <li v-for="d in docs" :key="'d' + d.id"
                        @click="openDoc(d.id)"
                        class="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/60 cursor-pointer group">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-400 shrink-0">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div class="flex-1 min-w-0">
                            <div class="text-[15px] truncate">{{ d.title || '未命名' }}</div>
                            <div class="text-xs text-zinc-500">{{ fmtTime(d.updated_at) }}</div>
                        </div>
                        <button @click="deleteDoc(d, $event)"
                            class="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-zinc-500 hover:text-rose-400 rounded">
                            删
                        </button>
                    </li>
                </ul>
                <div v-if="!loading && !folders.length && !docs.length"
                    class="text-center text-zinc-500 py-20 text-sm">
                    这里是空的,点上面"+ 文档"或"+ 文件夹"开始
                </div>
            </div>
        </div>
    </div>
</template>
