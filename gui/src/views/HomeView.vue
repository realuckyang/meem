<script setup>
import { computed, onMounted, ref } from 'vue';
import { useToastStore } from '@/stores/toast';
import { renderMd } from '@/utils/renderMd';

const toast = useToastStore();

const loading = ref(false);
const saving = ref(false);
const editMode = ref(false);
const content = ref('');
const filePath = ref('');
const updatedAt = ref(0);

const renderedHtml = computed(() => renderMd(content.value));

async function asJson(res) {
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json();
}

async function loadHome() {
    loading.value = true;
    try {
        const data = await fetch('/api/home').then(asJson);
        content.value = data.content || '';
        filePath.value = data.path || '';
        updatedAt.value = data.updated_at || 0;
    } catch (err) {
        toast.show(err.message || '加载失败');
    } finally {
        loading.value = false;
    }
}

async function saveHome() {
    saving.value = true;
    try {
        const data = await fetch('/api/home', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content.value }),
        }).then(asJson);
        content.value = data.content || '';
        filePath.value = data.path || '';
        updatedAt.value = data.updated_at || 0;
        editMode.value = false;
        toast.show('主页已更新');
    } catch (err) {
        toast.show(err.message || '保存失败');
    } finally {
        saving.value = false;
    }
}

async function copyPath() {
    if (!filePath.value) return;
    try {
        await navigator.clipboard.writeText(filePath.value);
        toast.show('路径已复制');
    } catch {
        toast.show('复制失败');
    }
}

function fmtTime(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

onMounted(loadHome);
</script>

<template>
    <main class="min-h-0 flex-1 overflow-y-auto" style="background-color: var(--color-bg); color: var(--color-ink);">
        <div class="mx-auto max-w-4xl px-6 py-6">

            <!-- 仿 GitHub 文件页头：路径 + 操作按钮 -->
            <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b" style="border-color: var(--color-line-hi);">
                <div class="flex items-center gap-2 min-w-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="color: var(--color-muted);" aria-hidden="true">
                        <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/>
                    </svg>
                    <span class="font-mono text-[13px]" style="color: var(--color-ink);">{{ filePath || 'AGENTS.md' }}</span>
                    <button class="ml-1 inline-flex h-6 w-6 items-center justify-center rounded transition-colors" title="复制路径" @click="copyPath"
                        style="color: var(--color-muted);"
                        @mouseover="(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hi)'; e.currentTarget.style.color = 'var(--color-ink)'; }"
                        @mouseout="(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-muted)'; }">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                        </svg>
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    <button class="gh-btn" @click="editMode = !editMode">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.756l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/>
                        </svg>
                        {{ editMode ? '预览' : '编辑' }}
                    </button>
                    <button class="gh-btn-primary" :disabled="saving" @click="saveHome">
                        {{ saving ? '保存中…' : '保存' }}
                    </button>
                </div>
            </div>

            <p v-if="updatedAt" class="text-xs mb-4" style="color: var(--color-muted);">
                更新于 <span class="font-mono">{{ fmtTime(updatedAt) }}</span>
            </p>

            <div v-if="loading" class="py-16 text-center text-sm" style="color: var(--color-muted);">加载中…</div>

            <textarea
                v-else-if="editMode"
                v-model="content"
                class="w-full min-h-[60vh] resize-y rounded-md border px-4 py-3 outline-none transition-colors"
                style="background-color: var(--color-bg-elev); border-color: var(--color-line-hi); color: var(--color-ink); font-family: var(--font-mono); font-size: 13px; line-height: 1.6;"
                @focus="(e) => { e.currentTarget.style.borderColor = 'var(--color-link)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-link) 30%, transparent)'; }"
                @blur="(e) => { e.currentTarget.style.borderColor = 'var(--color-line-hi)'; e.currentTarget.style.boxShadow = 'none'; }"></textarea>

            <article v-else class="gh-box overflow-hidden">
                <div class="px-4 py-2 border-b text-[12px] flex items-center gap-2"
                    style="border-color: var(--color-line-hi); background-color: var(--color-bg-elev); color: var(--color-muted);">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"/>
                    </svg>
                    AGENTS.md
                </div>
                <div class="px-6 py-5">
                    <div v-if="content" class="md" v-html="renderedHtml"></div>
                    <div v-else class="py-10 text-center text-sm" style="color: var(--color-muted);">AGENTS.md 还是空的</div>
                </div>
            </article>
        </div>
    </main>
</template>
