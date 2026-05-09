<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
    loading: Boolean,
    showSearch: Boolean,
    filterText: { type: String, default: '' },
});

const emit = defineEmits([
    'toggle-search',
    'refresh',
    'create-doc',
    'create-folder',
    'update:filterText',
]);

const searchInputEl = ref(null);

watch(() => props.showSearch, async (visible) => {
    if (!visible) return;
    await nextTick();
    searchInputEl.value?.focus();
});
</script>

<template>
    <div class="flex flex-wrap items-center gap-1 px-3 py-2.5">
        <button @click="emit('toggle-search')" class="tb-btn"
            :class="{ 'is-active': showSearch || filterText }" title="搜索">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>

        <button @click="emit('refresh')" class="tb-btn" title="刷新">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
        </button>

        <div class="w-px h-5 mx-1 bg-line"></div>

        <button @click="emit('create-doc')" class="tb-btn" title="新建文档">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/></svg>
        </button>

        <button @click="emit('create-folder')" class="tb-btn" title="新建文件夹">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        </button>

        <span class="ml-auto text-xs text-faint" v-if="loading">加载中…</span>
    </div>

    <div v-if="showSearch" class="flex items-center gap-2 px-3 py-2 border-t border-line">
        <svg width="14" height="14" class="shrink-0 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input ref="searchInputEl"
            :value="filterText"
            @input="emit('update:filterText', $event.target.value)"
            placeholder="在当前文件夹内搜索..."
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            class="flex-1 min-w-0 px-2 h-8 rounded text-xs outline-none border border-line bg-bg-elev text-ink focus:border-accent" />
        <button v-if="filterText" @click="emit('update:filterText', '')" class="tb-btn-sm" title="清空">
            ✕
        </button>
    </div>
</template>
