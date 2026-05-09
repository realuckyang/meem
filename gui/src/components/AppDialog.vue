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
            <div class="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
                <div class="px-5 pt-5 pb-2">
                    <div v-if="dialog.title" class="text-[15px] font-semibold text-zinc-100">{{ dialog.title }}</div>
                    <div v-if="dialog.message" class="mt-1 text-sm text-zinc-400 leading-relaxed">{{ dialog.message }}</div>
                </div>

                <div v-if="dialog.mode === 'prompt'" class="px-5 pt-2 pb-1">
                    <input ref="inputEl"
                        v-model="dialog.inputValue"
                        :placeholder="dialog.placeholder"
                        @keydown.enter="onKeyEnter"
                        type="text"
                        class="w-full px-3 h-10 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 border border-zinc-800 rounded focus:outline-none focus:border-emerald-600 transition-colors" />
                </div>

                <div class="flex items-center justify-end gap-2 px-5 py-4">
                    <button @click="dialog.dismiss"
                        class="inline-flex h-9 items-center justify-center rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 text-sm text-zinc-200 transition-colors">
                        {{ dialog.cancelText }}
                    </button>
                    <button @click="dialog.accept"
                        class="inline-flex h-9 items-center justify-center rounded px-4 text-sm font-medium transition-colors"
                        :class="dialog.danger
                            ? 'border border-rose-700 bg-rose-600 hover:bg-rose-500 text-white'
                            : 'border border-emerald-700 bg-emerald-600 hover:bg-emerald-500 text-white'">
                        {{ dialog.confirmText }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
