<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToastStore } from '@/stores/toast';
import { accessLabel, accessStyle } from './memory/access.js';

const router = useRouter();
const toast = useToastStore();

const loading = ref(false);
const filterText = ref('');
const items = ref([]);

const filteredItems = computed(() => {
    const q = filterText.value.trim().toLowerCase();
    if (!q) return items.value;
    return items.value.filter((item) => [
        item.title,
        item.summary,
        item.content,
        accessLabel(item.access),
    ].join('\n').toLowerCase().includes(q));
});

async function asJson(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

function sortItems(list) {
    return [...list].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
        || Number(b.id) - Number(a.id));
}

async function loadItems() {
    loading.value = true;
    try {
        const data = await fetch('/api/memory').then(asJson);
        items.value = sortItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
        toast.show(err.message || '加载记忆失败');
    } finally {
        loading.value = false;
    }
}

function fmtTime(value) {
    if (!value) return '';
    const d = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function refreshWhenVisible() {
    if (document.visibilityState === 'visible') loadItems();
}

onMounted(() => {
    loadItems();
    window.addEventListener('focus', loadItems);
    document.addEventListener('visibilitychange', refreshWhenVisible);
});

onBeforeUnmount(() => {
    window.removeEventListener('focus', loadItems);
    document.removeEventListener('visibilitychange', refreshWhenVisible);
});
</script>

<template>
    <main class="min-h-0 flex-1 overflow-y-auto" style="background-color: var(--color-bg); color: var(--color-ink);">
        <div class="mx-auto max-w-5xl px-6 py-6">

            <!-- 标题区，仿 GitHub Issues 顶栏 -->
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h1 class="text-[20px] font-semibold leading-tight" style="color: var(--color-ink);">记忆</h1>
                <div class="flex items-center gap-2">
                    <button class="gh-btn" title="刷新" @click="loadItems">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .655-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/>
                        </svg>
                        刷新
                    </button>
                    <RouterLink class="gh-btn-primary" to="/memory/new">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
                        </svg>
                        新建记忆
                    </RouterLink>
                </div>
            </div>

            <p class="text-[13px] mb-4" style="color: var(--color-muted);">只存不读，星标读摘要，必读读正文。</p>

            <!-- GitHub Issues 风格的列表盒子 -->
            <div class="gh-box overflow-hidden">
                <!-- 搜索栏 / 过滤 -->
                <div class="px-4 py-3 border-b flex items-center gap-3 flex-wrap" style="border-color: var(--color-line-hi); background-color: var(--color-bg-elev);">
                    <div class="relative flex-1 min-w-[200px]">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
                            class="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            style="color: var(--color-muted);" aria-hidden="true">
                            <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
                        </svg>
                        <input
                            v-model="filterText"
                            placeholder="搜索记忆…"
                            class="gh-input pl-8" />
                    </div>
                    <div class="text-[12px]" style="color: var(--color-muted);">
                        {{ filteredItems.length }} / {{ items.length }} 条
                    </div>
                </div>

                <!-- 列表 -->
                <div v-if="loading && !items.length" class="py-16 text-center text-sm" style="color: var(--color-muted);">加载中…</div>
                <div v-else-if="!filteredItems.length" class="py-16 text-center text-sm" style="color: var(--color-muted);">
                    {{ filterText ? '没有匹配的记忆' : '还没有记忆' }}
                </div>

                <ul v-else>
                    <li
                        v-for="(item, idx) in filteredItems"
                        :key="item.id"
                        class="px-4 py-3 cursor-pointer transition-colors"
                        :style="`border-top: ${idx === 0 ? '0' : '1px'} solid var(--color-line-hi);`"
                        @click="router.push(`/memory/${item.id}`)"
                        @mouseover="(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hi)'; }"
                        @mouseout="(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }">
                        <div class="flex items-start gap-3">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
                                class="mt-0.5 shrink-0"
                                :style="item.access === 'full' ? 'color: var(--color-good);' : item.access === 'summary' ? 'color: var(--color-link);' : 'color: var(--color-muted);'"
                                aria-hidden="true">
                                <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                            </svg>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-baseline gap-2 flex-wrap">
                                    <span class="text-[14px] font-semibold" style="color: var(--color-ink);">{{ item.title }}</span>
                                    <span class="gh-label" :style="accessStyle(item.access)">{{ accessLabel(item.access) }}</span>
                                </div>
                                <p v-if="item.summary || item.content" class="mt-1 text-[12px] line-clamp-2 leading-relaxed" style="color: var(--color-muted);">
                                    {{ item.summary || item.content }}
                                </p>
                                <div class="mt-1 text-[12px]" style="color: var(--color-faint);">
                                    #{{ item.id }} · 更新于 <span class="font-mono">{{ fmtTime(item.updated_at || item.created_at) }}</span>
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </main>
</template>
