<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useDialogStore } from '@/stores/dialog';
import { useToastStore } from '@/stores/toast';
import { renderMd } from '@/utils/renderMd';
import DocEditorView from './DocEditorView.vue';
import DocsBreadcrumb from './DocsBreadcrumb.vue';
import DocsList from './DocsList.vue';
import DocsToolbar from './DocsToolbar.vue';

const dialog = useDialogStore();
const toast = useToastStore();

const editMode = ref(false);

async function asJson(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const data = await res.json(); if (data?.error) msg = data.error; } catch {}
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
const showSearch = ref(false);
const filterText = ref('');

const editing = ref(null);
const editorTitle = ref('');
const editorContent = ref('');
const dirty = ref(false);
let saveTimer = null;

const isEditing = computed(() => !!editing.value);
const normalizedFilter = computed(() => filterText.value.trim().toLowerCase());
const filteredFolders = computed(() => {
    const q = normalizedFilter.value;
    if (!q) return folders.value;
    return folders.value.filter((f) => String(f.name || '').toLowerCase().includes(q));
});
const filteredDocs = computed(() => {
    const q = normalizedFilter.value;
    if (!q) return docs.value;
    return docs.value.filter((d) => String(d.title || '').toLowerCase().includes(q));
});
const empty = computed(() => !loading.value && !folders.value.length && !docs.value.length);
const filteredEmpty = computed(() => !loading.value && !filteredFolders.value.length && !filteredDocs.value.length);
const renderedHtml = computed(() => renderMd(editorContent.value));

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

function toggleSearch() {
    showSearch.value = !showSearch.value;
    if (!showSearch.value) filterText.value = '';
}

async function navigate(folderId) {
    cwdId.value = folderId ?? null;
    await refresh();
}

async function createFolder() {
    const name = await dialog.prompt({
        title: '新建文件夹',
        message: cwd.value ? `在 "${cwd.value.name}" 下创建` : '在根目录下创建',
        placeholder: '文件夹名称',
    });
    if (!name?.trim()) return;
    await fetch('/api/docs/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: cwdId.value, name: name.trim() }),
    }).then(asJson);
    await refresh();
}

async function renameFolder(f) {
    const name = await dialog.prompt({
        title: '重命名文件夹',
        defaultValue: f.name,
        placeholder: '新名称',
    });
    if (!name?.trim() || name === f.name) return;
    await fetch(`/api/docs/folders/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
    }).then(asJson);
    await refresh();
}

async function deleteFolder(f) {
    const ok = await dialog.confirm({
        title: '删除文件夹',
        message: `确定删除"${f.name}"及其全部内容？此操作不可恢复。`,
        confirmText: '删除',
        danger: true,
    });
    if (!ok) return;
    await fetch(`/api/docs/folders/${f.id}`, { method: 'DELETE' }).then(asJson);
    toast.show('已删除');
    await refresh();
}

async function createDoc() {
    const created = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: cwdId.value, title: '未命名' }),
    }).then(asJson);
    await refresh();
    await openDoc(created.id, true);
}

async function openDoc(id, edit = false) {
    editing.value = await fetch(`/api/docs/${id}`).then(asJson);
    editMode.value = edit;
}

async function deleteDoc(d) {
    const ok = await dialog.confirm({
        title: '删除文档',
        message: `确定删除"${d.title || '未命名'}"？此操作不可恢复。`,
        confirmText: '删除',
        danger: true,
    });
    if (!ok) return;
    await fetch(`/api/docs/${d.id}`, { method: 'DELETE' }).then(asJson);
    if (editing.value?.id === d.id) editing.value = null;
    toast.show('已删除');
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
    <div class="flex flex-col h-full bg-bg text-ink min-h-0">
        <DocEditorView v-if="isEditing"
            v-model:title="editorTitle"
            v-model:content="editorContent"
            :edit-mode="editMode"
            :dirty="dirty"
            :updated-at="editing?.updated_at"
            :rendered-html="renderedHtml"
            :fmt-time="fmtTime"
            @close="closeEditor"
            @toggle-edit="editMode = !editMode"
            @save-input="scheduleSave"
            @save-blur="flushSave" />

        <div v-else class="flex flex-col flex-1 min-h-0">
            <header class="shrink-0 border-b border-line bg-bg">
                <DocsToolbar
                    v-model:filter-text="filterText"
                    :loading="loading"
                    :show-search="showSearch"
                    @toggle-search="toggleSearch"
                    @refresh="refresh"
                    @create-doc="createDoc"
                    @create-folder="createFolder" />
                <DocsBreadcrumb
                    :cwd-id="cwdId"
                    :breadcrumb="breadcrumb"
                    @navigate="navigate" />
            </header>

            <DocsList
                :folders="filteredFolders"
                :docs="filteredDocs"
                :empty="empty"
                :filtered-empty="filteredEmpty"
                :fmt-time="fmtTime"
                @navigate="navigate"
                @rename-folder="renameFolder"
                @delete-folder="deleteFolder"
                @open-doc="openDoc"
                @delete-doc="deleteDoc" />
        </div>
    </div>
</template>
