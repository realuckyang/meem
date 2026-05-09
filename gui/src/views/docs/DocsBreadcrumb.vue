<script setup>
defineProps({
    cwdId: { type: [Number, String, null], default: null },
    breadcrumb: { type: Array, default: () => [] },
});

const emit = defineEmits(['navigate']);
</script>

<template>
    <div class="flex flex-wrap items-center gap-x-0.5 gap-y-1 px-3 py-2 border-t border-line text-sm">
        <button @click="emit('navigate', null)"
            class="px-2 py-0.5 rounded shrink-0 transition-colors"
            :class="cwdId === null ? 'text-ink font-medium' : 'text-muted hover:text-ink hover:bg-bg-hi'">
            根目录
        </button>
        <template v-for="(c, i) in breadcrumb" :key="c.id">
            <span class="text-faint shrink-0">/</span>
            <button @click="emit('navigate', c.id)"
                class="px-2 py-0.5 rounded shrink-0 max-w-[40vw] truncate transition-colors"
                :class="i === breadcrumb.length - 1 ? 'text-ink font-medium' : 'text-muted hover:text-ink hover:bg-bg-hi'">
                {{ c.name }}
            </button>
        </template>
    </div>
</template>
