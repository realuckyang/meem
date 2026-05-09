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
    <header
        class="safe-top shrink-0 flex items-center gap-3 px-3 h-12 border-b"
        style="background-color: var(--color-bg-elev); border-color: var(--color-line-hi);">
        <button
            @click="view.toggleDrawer"
            class="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            style="color: var(--color-muted);"
            onmouseover="this.style.backgroundColor='var(--color-bg-hi)'; this.style.color='var(--color-ink)';"
            onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--color-muted)';"
            title="菜单">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z"/>
            </svg>
        </button>

        <div class="flex items-center gap-2 min-w-0">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" style="color: var(--color-ink);" aria-hidden="true">
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
            </svg>
            <span class="font-semibold text-[14px] truncate" style="color: var(--color-ink);">Meem</span>
            <span class="text-[14px] truncate" style="color: var(--color-muted);">/</span>
            <span class="font-semibold text-[14px] truncate" style="color: var(--color-link);">{{ currentLabel }}</span>
        </div>
    </header>
</template>
