<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

const loading = ref(false);
const errorMsg = ref('');
const imageUrl = ref('');
const capturedAt = ref(0);
const naturalSize = ref({ width: 0, height: 0 });

const capturedText = computed(() => {
    if (!capturedAt.value) return '尚未截图';
    return new Date(capturedAt.value).toLocaleString();
});

const sizeText = computed(() => {
    const { width, height } = naturalSize.value;
    return width && height ? `${width} x ${height}` : '';
});

function clearImage() {
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = '';
    naturalSize.value = { width: 0, height: 0 };
}

async function capture() {
    loading.value = true;
    errorMsg.value = '';
    try {
        const res = await fetch('/api/screen/snapshot', { cache: 'no-store' });
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
                const data = await res.json();
                if (data?.error) msg = data.error;
            } catch {}
            throw new Error(msg);
        }
        const ts = Number(res.headers.get('X-Captured-At')) || Date.now();
        const blob = await res.blob();
        clearImage();
        imageUrl.value = URL.createObjectURL(blob);
        capturedAt.value = ts;
    } catch (err) {
        errorMsg.value = err.message || String(err);
    } finally {
        loading.value = false;
    }
}

function onImageLoad(e) {
    naturalSize.value = { width: e.target.naturalWidth, height: e.target.naturalHeight };
}

onMounted(() => {
    if (!imageUrl.value) capture();
});

onUnmounted(() => {
    clearImage();
});
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col bg-zinc-950">
        <div class="shrink-0 border-b border-zinc-800 bg-zinc-900/70 px-3 py-2">
            <div class="flex min-w-0 items-center gap-2">
                <button
                    @click="capture"
                    :disabled="loading"
                    class="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 transition-colors hover:bg-zinc-700 active:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                    title="刷新截图">
                    <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
                        <path d="M3 21v-5h5" />
                        <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                    <span>{{ loading ? '截图中' : '刷新' }}</span>
                </button>

                <div class="min-w-0 flex-1 text-right text-xs text-zinc-500">
                    <div class="truncate">{{ capturedText }}</div>
                    <div v-if="sizeText" class="truncate font-mono">{{ sizeText }}</div>
                </div>
            </div>
        </div>

        <main class="relative min-h-0 flex-1 overflow-auto bg-black">
            <div v-if="errorMsg" class="flex h-full items-center justify-center px-4 text-center">
                <div>
                    <div class="mb-3 text-sm text-red-300">{{ errorMsg }}</div>
                    <button
                        @click="capture"
                        class="inline-flex h-9 items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 hover:bg-zinc-700">
                        重试
                    </button>
                </div>
            </div>

            <div v-else-if="imageUrl" class="flex min-h-full items-start justify-center p-3">
                <img
                    :src="imageUrl"
                    alt="桌面截图"
                    class="h-auto max-w-full rounded border border-zinc-800 bg-black shadow-2xl"
                    :class="{ 'opacity-70': loading }"
                    @load="onImageLoad" />
            </div>

            <div v-else class="flex h-full items-center justify-center text-sm text-zinc-500">
                {{ loading ? '正在获取桌面截图...' : '点击刷新获取截图' }}
            </div>
        </main>
    </div>
</template>
