<script setup>
defineProps({
    folders: { type: Array, default: () => [] },
    docs: { type: Array, default: () => [] },
    empty: Boolean,
    filteredEmpty: Boolean,
    fmtTime: { type: Function, required: true },
});

const emit = defineEmits([
    'navigate',
    'rename-folder',
    'delete-folder',
    'open-doc',
    'delete-doc',
]);
</script>

<template>
    <div class="flex-1 min-h-0 overflow-y-auto">
        <ul class="divide-y divide-line">
            <li v-for="f in folders" :key="'f' + f.id"
                @click="emit('navigate', f.id)"
                class="flex items-center gap-3 px-4 py-3 hover:bg-bg-elev cursor-pointer transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span class="flex-1 text-[15px] truncate">{{ f.name }}</span>
                <button @click.stop="emit('rename-folder', f)"
                    title="重命名"
                    class="icon-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                </button>
                <button @click.stop="emit('delete-folder', f)"
                    title="删除"
                    class="icon-btn-danger">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6" /></svg>
                </button>
            </li>

            <li v-for="d in docs" :key="'d' + d.id"
                @click="emit('open-doc', d.id)"
                class="flex items-center gap-3 px-4 py-3 hover:bg-bg-elev cursor-pointer transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <div class="flex-1 min-w-0">
                    <div class="text-[15px] truncate">{{ d.title || '未命名' }}</div>
                    <div class="text-xs text-muted mt-0.5">{{ fmtTime(d.updated_at) }}</div>
                </div>
                <button @click.stop="emit('delete-doc', d)"
                    title="删除"
                    class="icon-btn-danger">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6" /></svg>
                </button>
            </li>
        </ul>

        <div v-if="empty" class="text-center py-20">
            <div class="mx-auto mb-4 w-12 h-12 rounded-full bg-bg-elev flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-faint">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
            </div>
            <div class="text-sm text-muted">这里是空的</div>
            <div class="mt-1 text-xs text-faint">点上面"文档"或"文件夹"开始</div>
        </div>

        <div v-else-if="filteredEmpty" class="text-center py-20">
            <div class="mx-auto mb-4 w-12 h-12 rounded-full bg-bg-elev flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-faint"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div class="text-sm text-muted">没有匹配结果</div>
            <div class="mt-1 text-xs text-faint">换个关键词试试</div>
        </div>
    </div>
</template>
