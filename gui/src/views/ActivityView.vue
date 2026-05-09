<script setup>
const timelineItems = [
    {
        date: '2026-05-09',
        title: 'Meem 开发整理',
        content: '今天重新启动并整理了 Meem：移除收件箱模块，保留文档、文件、终端、屏幕和对话核心工作台；文档与文件预览补充了复制路径能力，让 agent 和人都能更快引用当前上下文。',
    },
];
</script>

<template>
    <main class="min-h-0 flex-1 overflow-y-auto" style="background-color: var(--color-bg); color: var(--color-ink);">
        <div class="mx-auto max-w-3xl px-6 py-6">
            <div class="mb-5">
                <h1 class="text-[20px] font-semibold leading-tight" style="color: var(--color-ink);">动态</h1>
                <p class="mt-1 text-[13px]" style="color: var(--color-muted);">Meem 的开发与工作记录时间轴。</p>
            </div>

            <!-- GitHub PR / Issue Timeline 视觉 -->
            <ol class="relative ml-3 pl-6" style="border-left: 2px solid var(--color-line-hi);">
                <li
                    v-for="item in timelineItems"
                    :key="item.date + item.title"
                    class="relative mb-6 last:mb-0">
                    <span
                        class="absolute -left-[34px] top-0 inline-flex h-7 w-7 items-center justify-center rounded-full border-2"
                        style="background-color: var(--color-bg); border-color: var(--color-line-hi); color: var(--color-link);">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M1.643 3.143 1 .857a.5.5 0 0 1 .986 0l-.643 2.286a.5.5 0 0 1-.7-.001ZM3 7v6.25c0 1.18 1.025 2 2 2 .91 0 1.694-.503 1.94-1.245A.75.75 0 0 0 8 13.25v-2.5a.75.75 0 0 0-.75-.75H6.5V8.5a3 3 0 0 0-3-3H3Zm9.5 0v6.25c0 1.18-1.025 2-2 2-.91 0-1.694-.503-1.94-1.245A.75.75 0 0 1 8 13.25v-2.5a.75.75 0 0 1 .75-.75H9.5V8.5a3 3 0 0 1 3-3h.5Z"/>
                            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z"/>
                        </svg>
                    </span>

                    <div class="gh-box overflow-hidden">
                        <div class="px-4 py-2 border-b flex items-baseline gap-2 flex-wrap"
                            style="border-color: var(--color-line-hi); background-color: var(--color-bg-elev);">
                            <span class="text-[13px] font-semibold" style="color: var(--color-ink);">{{ item.title }}</span>
                            <time class="font-mono text-[11px]" style="color: var(--color-muted);">{{ item.date }}</time>
                        </div>
                        <div class="px-4 py-3 text-[13px] leading-relaxed" style="color: var(--color-ink);">
                            {{ item.content }}
                        </div>
                    </div>
                </li>
            </ol>
        </div>
    </main>
</template>
