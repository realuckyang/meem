<script setup>
import { useToastStore } from '@/stores/toast';
const toast = useToastStore();
</script>

<template>
    <div v-if="toast.message"
        class="toast-enter fixed left-1/2 -translate-x-1/2 bottom-20 px-3 py-2 rounded-md shadow-lg text-[13px] z-50 pointer-events-none border"
        style="background-color: var(--color-bg-elev); border-color: var(--color-line-hi); color: var(--color-ink);">
        {{ toast.message }}
    </div>
</template>
