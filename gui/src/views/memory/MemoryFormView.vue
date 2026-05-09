<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToastStore } from '@/stores/toast';
import { accessClass, accessOptions } from './access.js';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const item = ref(emptyItem());

const isNew = computed(() => route.name === 'memory-new');
const canSave = computed(() => item.value.title.trim().length > 0);

function emptyItem() {
    return {
        id: null,
        title: '',
        summary: '',
        content: '',
        access: 'none',
    };
}

async function asJson(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

async function loadItem() {
    if (isNew.value) {
        item.value = emptyItem();
        return;
    }
    loading.value = true;
    try {
        const data = await fetch(`/api/memory/${route.params.id}`).then(asJson);
        item.value = data.item || emptyItem();
    } catch (err) {
        toast.show(err.message || '加载记忆失败');
        router.replace('/memory');
    } finally {
        loading.value = false;
    }
}

async function saveItem() {
    if (!canSave.value || saving.value) return;
    saving.value = true;
    const payload = {
        title: item.value.title.trim(),
        summary: String(item.value.summary || '').trim(),
        content: String(item.value.content || '').trim(),
        access: item.value.access,
    };
    try {
        const data = await fetch(isNew.value ? '/api/memory' : `/api/memory/${item.value.id}`, {
            method: isNew.value ? 'POST' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(asJson);
        item.value = data.item;
        toast.show('记忆已保存');
        if (isNew.value) router.replace(`/memory/${data.item.id}`);
    } catch (err) {
        toast.show(err.message || '保存失败');
    } finally {
        saving.value = false;
    }
}

async function deleteItem() {
    if (!item.value.id || deleting.value) return;
    if (!confirm(`删除「${item.value.title || '未命名'}」?`)) return;
    deleting.value = true;
    try {
        await fetch(`/api/memory/${item.value.id}`, { method: 'DELETE' }).then(asJson);
        toast.show('记忆已删除');
        router.replace('/memory');
    } catch (err) {
        toast.show(err.message || '删除失败');
    } finally {
        deleting.value = false;
    }
}

watch(() => route.fullPath, loadItem);
onMounted(loadItem);
</script>

<template>
    <main class="min-h-0 flex-1 overflow-y-auto bg-bg text-ink">
        <div class="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-5">
            <header class="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                    <button class="mb-2 text-sm text-muted hover:text-ink" @click="router.push('/memory')">← 返回记忆列表</button>
                    <h1 class="font-serif text-[26px] font-semibold leading-tight">{{ isNew ? '新建记忆' : '记忆详情' }}</h1>
                    <p class="mt-1 text-sm text-muted">只存不读，星标读摘要，必读读正文。</p>
                </div>
                <div class="flex shrink-0 gap-2">
                    <button
                        v-if="!isNew"
                        class="h-9 rounded border border-line px-3 text-sm text-muted hover:border-red-500 hover:text-red-500"
                        :disabled="deleting"
                        @click="deleteItem">
                        删除
                    </button>
                    <button
                        class="h-9 rounded bg-accent px-3 text-sm font-medium text-bg hover:bg-accent-hi disabled:opacity-60"
                        :disabled="!canSave || saving"
                        @click="saveItem">
                        {{ saving ? '保存中...' : '保存' }}
                    </button>
                </div>
            </header>

            <div v-if="loading" class="flex flex-1 items-center justify-center text-sm text-muted">加载中...</div>
            <section v-else class="flex min-h-0 flex-1 flex-col">
                <div class="mb-4 grid grid-cols-3 gap-2">
                    <button
                        v-for="option in accessOptions"
                        :key="option.value"
                        class="rounded border px-3 py-2 text-left transition-colors"
                        :class="item.access === option.value ? accessClass(option.value) : 'border-line bg-bg-elev text-ink hover:border-accent'"
                        @click="item.access = option.value">
                        <div class="text-sm font-medium">{{ option.label }}</div>
                        <div class="mt-0.5 text-xs opacity-75">{{ option.desc }}</div>
                    </button>
                </div>

                <div class="flex min-h-0 flex-1 flex-col gap-3">
                    <input
                        v-model="item.title"
                        placeholder="记忆标题"
                        class="h-11 rounded border border-line bg-bg-elev px-3 text-base font-medium text-ink outline-none focus:border-accent" />
                    <textarea
                        v-model="item.summary"
                        placeholder="摘要：星标时 AI 会读取这里"
                        class="h-28 resize-none rounded border border-line bg-bg-elev px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-accent"></textarea>
                    <textarea
                        v-model="item.content"
                        placeholder="正文：必读时 AI 会读取这里"
                        class="min-h-[320px] flex-1 resize-none rounded border border-line bg-bg-elev px-3 py-2 font-mono text-sm leading-relaxed text-ink outline-none focus:border-accent"></textarea>
                </div>
            </section>
        </div>
    </main>
</template>
