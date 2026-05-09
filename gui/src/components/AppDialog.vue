<script setup>
import { nextTick, ref, watch } from 'vue';
import { useDialogStore } from '@/stores/dialog';

const dialog = useDialogStore();
const inputEl = ref(null);

watch(() => dialog.open, async (v) => {
    if (!v) return;
    if (dialog.mode === 'prompt') {
        await nextTick();
        inputEl.value?.focus();
        inputEl.value?.select();
    }
});

function onKeyEnter(e) {
    if (e.isComposing) return;
    e.preventDefault();
    dialog.accept();
}
</script>

<template>
    <Transition
        enter-active-class="transition duration-150"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <div v-if="dialog.open"
            class="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
            @click.self="dialog.dismiss"
            @keydown.esc="dialog.dismiss">
            <div
                class="w-full max-w-md rounded-md border shadow-2xl overflow-hidden"
                style="background-color: var(--color-bg-elev); border-color: var(--color-line-hi);">

                <div
                    class="px-4 py-3 border-b text-[14px] font-semibold"
                    style="border-color: var(--color-line-hi); color: var(--color-ink);">
                    {{ dialog.title || '确认' }}
                </div>

                <div class="px-4 py-4">
                    <div v-if="dialog.message" class="text-[13px] leading-relaxed" style="color: var(--color-ink);">{{ dialog.message }}</div>
                    <div v-if="dialog.mode === 'prompt'" class="mt-3">
                        <input ref="inputEl"
                            v-model="dialog.inputValue"
                            :placeholder="dialog.placeholder"
                            @keydown.enter="onKeyEnter"
                            type="text"
                            class="gh-input" />
                    </div>
                </div>

                <div
                    class="flex items-center justify-end gap-2 px-4 py-3 border-t"
                    style="border-color: var(--color-line-hi); background-color: var(--color-bg);">
                    <button @click="dialog.dismiss" class="gh-btn">{{ dialog.cancelText }}</button>
                    <button
                        @click="dialog.accept"
                        :class="dialog.danger ? 'gh-btn-danger' : 'gh-btn-primary'">
                        {{ dialog.confirmText }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
