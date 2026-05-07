<script setup>
import { onMounted, ref } from 'vue';

const items = ref([]);
const loading = ref(false);
const draft = ref('');

async function load() {
    loading.value = true;
    try {
        const r = await fetch('/api/todos');
        items.value = await r.json();
    } finally {
        loading.value = false;
    }
}

async function add() {
    const v = draft.value.trim();
    if (!v) return;
    draft.value = '';
    await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: v }),
    });
    await load();
}

async function toggle(t) {
    await fetch(`/api/todos/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !t.done }),
    });
    await load();
}

async function remove(t) {
    await fetch(`/api/todos/${t.id}`, { method: 'DELETE' });
    await load();
}

onMounted(load);
</script>

<template>
    <div class="flex flex-col h-full bg-zinc-950 text-zinc-100">
        <div class="flex-1 overflow-y-auto px-4 pb-32 pt-4 max-w-2xl mx-auto w-full">
            <ul v-if="items.length" class="space-y-2">
                <li v-for="t in items" :key="t.id"
                    class="flex items-center gap-3 px-3 py-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <button @click="toggle(t)"
                        class="w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors"
                        :class="t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 hover:border-zinc-400'">
                        <svg v-if="t.done" width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                    <span class="flex-1 text-[15px] leading-snug break-words"
                        :class="t.done ? 'line-through text-zinc-500' : 'text-zinc-100'">
                        {{ t.title }}
                    </span>
                    <button @click="remove(t)"
                        class="text-xs text-zinc-500 hover:text-rose-400 px-2 py-1 rounded">
                        删除
                    </button>
                </li>
            </ul>
            <div v-else-if="!loading"
                class="text-center text-zinc-500 py-20 text-sm">
                还没有 todo,在下面输入一个开始
            </div>
        </div>

        <div class="fixed left-0 right-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur"
            style="padding-bottom: calc(env(safe-area-inset-bottom));">
            <div class="max-w-2xl mx-auto w-full px-4 py-3 flex gap-2">
                <input v-model="draft" @keydown.enter="add"
                    placeholder="添加一个 todo..." enterkeyhint="done" autocomplete="off"
                    class="flex-1 min-w-0 text-[15px] px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500" />
                <button :disabled="!draft.trim()" @click="add"
                    class="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-zinc-100 text-zinc-900 disabled:opacity-40">
                    添加
                </button>
            </div>
        </div>
    </div>
</template>
