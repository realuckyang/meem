<script setup>
import { computed } from 'vue';

const props = defineProps({
    editMode: Boolean,
    dirty: Boolean,
    updatedAt: { type: String, default: '' },
    docPath: { type: String, default: '' },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    renderedHtml: { type: String, default: '' },
    fmtTime: { type: Function, required: true },
});

const emit = defineEmits([
    'close',
    'toggle-edit',
    'copy-path',
    'update:title',
    'update:content',
    'save-input',
    'save-blur',
]);

const editorTitle = computed({
    get: () => props.title,
    set: (value) => emit('update:title', value),
});

const editorContent = computed({
    get: () => props.content,
    set: (value) => emit('update:content', value),
});
</script>

<template>
    <div class="flex flex-col flex-1 min-h-0">
        <header class="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-line bg-bg-elev/70">
            <button @click="emit('close')"
                title="返回"
                class="tb-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5 M12 19l-7-7 7-7" /></svg>
            </button>
            <span class="text-xs text-muted">
                <span v-if="editMode && dirty">保存中…</span>
                <span v-else-if="editMode">已保存 · {{ fmtTime(updatedAt) }}</span>
                <span v-else>{{ fmtTime(updatedAt) }}</span>
            </span>
            <button @click="emit('copy-path')"
                title="复制路径"
                class="tb-btn ml-auto">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button @click="emit('toggle-edit')"
                :title="editMode ? '完成' : '编辑'"
                class="inline-flex h-9 items-center gap-1.5 rounded border px-3 text-sm transition-colors"
                :class="editMode
                    ? 'border-accent bg-accent text-bg hover:bg-accent-hi'
                    : 'border-line bg-bg-elev text-ink hover:border-accent'">
                <svg v-if="!editMode" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {{ editMode ? '完成' : '编辑' }}
            </button>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto">
            <div class="mx-auto flex min-h-full max-w-3xl flex-col px-5 pt-6 pb-4">
                <div v-if="editMode" class="flex min-h-0 flex-1 flex-col">
                    <input v-model="editorTitle" @input="emit('save-input')" @blur="emit('save-blur')"
                        placeholder="标题"
                        class="w-full bg-transparent text-[24px] font-semibold text-ink outline-none border-none placeholder:text-faint mb-4" />
                    <textarea v-model="editorContent" @input="emit('save-input')" @blur="emit('save-blur')"
                        placeholder="开始写… 支持 Markdown"
                        class="min-h-0 flex-1 w-full overflow-y-auto bg-transparent text-[14px] leading-relaxed text-ink outline-none resize-none placeholder:text-faint font-mono"></textarea>
                </div>

                <template v-else>
                    <h1 class="text-[26px] font-semibold text-ink mb-5 leading-tight font-serif">
                        {{ title || '未命名' }}
                    </h1>
                    <div v-if="content" class="md" v-html="renderedHtml"></div>
                    <div v-else class="text-faint text-sm py-12 text-center">
                        空文档,点右上角"编辑"开始写
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>
