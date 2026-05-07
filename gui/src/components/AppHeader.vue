<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useViewStore } from '@/stores/view';

const view = useViewStore();
const route = useRoute();

const currentLabel = computed(() => {
    return view.navItems.find((item) => item.path === route.path)?.label || '';
});
</script>

<template>
    <header class="safe-top shrink-0 flex items-center gap-3 px-3 py-2.5 bg-zinc-900/80 backdrop-blur border-b border-zinc-800">
        <button
            @click="view.toggleDrawer"
            class="shrink-0 w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
            title="菜单">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <div class="min-w-0 flex-1">
            <div class="truncate font-serif font-bold text-[15px] tracking-tight text-zinc-100">{{ currentLabel }}</div>
        </div>
    </header>
</template>
