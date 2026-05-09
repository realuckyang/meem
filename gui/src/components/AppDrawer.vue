<script setup>
import { useRouter, useRoute } from 'vue-router';
import { useViewStore } from '@/stores/view';

const router = useRouter();
const route = useRoute();
const view = useViewStore();

function navigateTo(path) {
    view.closeDrawer();
    if (route.path !== path) router.push(path);
}
</script>

<template>
    <div v-if="view.showDrawer"
        class="fixed inset-0 z-40"
        @click.self="view.closeDrawer">
        <div class="fade-enter absolute inset-0 bg-black/60"></div>
        <aside
            class="drawer-enter absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col safe-top safe-bottom border-r"
            style="background-color: var(--color-bg-elev); border-color: var(--color-line-hi);">

            <div class="shrink-0 flex items-center justify-between px-4 h-12 border-b"
                style="border-color: var(--color-line-hi);">
                <div class="flex items-center gap-2 min-w-0">
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" style="color: var(--color-ink);" aria-hidden="true">
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
                    </svg>
                    <span class="font-semibold text-[14px]" style="color: var(--color-ink);">Meem</span>
                </div>
                <button @click="view.closeDrawer"
                    class="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                    style="color: var(--color-muted);"
                    onmouseover="this.style.backgroundColor='var(--color-bg-hi)'; this.style.color='var(--color-ink)';"
                    onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--color-muted)';">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
                    </svg>
                </button>
            </div>

            <nav class="flex-1 overflow-y-auto p-2">
                <button v-for="item in view.navItems" :key="item.path"
                    @click="navigateTo(item.path)"
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left text-[13px] transition-colors mb-0.5"
                    :style="route.path === item.path
                        ? 'background-color: var(--color-bg-hi); color: var(--color-ink); font-weight: 600;'
                        : 'color: var(--color-ink); font-weight: 400;'"
                    @mouseover="(e) => { if (route.path !== item.path) e.currentTarget.style.backgroundColor = 'var(--color-bg-hi)'; }"
                    @mouseout="(e) => { if (route.path !== item.path) e.currentTarget.style.backgroundColor = 'transparent'; }">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                        :style="route.path === item.path ? 'color: var(--color-link);' : 'color: var(--color-muted);'">
                        <path :d="item.iconPath" />
                    </svg>
                    <span>{{ item.label }}</span>
                </button>
            </nav>

            <div class="shrink-0 p-2 border-t" style="border-color: var(--color-line-hi);">
                <button
                    @click="navigateTo('/settings')"
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left text-[13px] transition-colors"
                    :style="route.path === '/settings'
                        ? 'background-color: var(--color-bg-hi); color: var(--color-ink); font-weight: 600;'
                        : 'color: var(--color-ink); font-weight: 400;'"
                    @mouseover="(e) => { if (route.path !== '/settings') e.currentTarget.style.backgroundColor = 'var(--color-bg-hi)'; }"
                    @mouseout="(e) => { if (route.path !== '/settings') e.currentTarget.style.backgroundColor = 'transparent'; }">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
                        :style="route.path === '/settings' ? 'color: var(--color-link);' : 'color: var(--color-muted);'">
                        <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"/>
                    </svg>
                    <span>设置</span>
                </button>
            </div>

        </aside>
    </div>
</template>
