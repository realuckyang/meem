<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWsStore } from '@/stores/ws';
import AppHeader from '@/components/AppHeader.vue';
import AppDrawer from '@/components/AppDrawer.vue';
import ToastHost from '@/components/ToastHost.vue';
import AppDialog from '@/components/AppDialog.vue';

const ws = useWsStore();
const route = useRoute();
const router = useRouter();

const showChrome = computed(() => route.name !== 'guard');

onMounted(() => {
    ws.init();
});

// 设了密码且未通过时，去密码页
watch(
    () => [ws.requiresPassword, ws.authenticated],
    ([req, authed]) => {
        if (req && !authed && route.name !== 'guard') {
            router.replace({ path: '/guard' });
        }
    },
    { immediate: true }
);
</script>

<template>
    <AppHeader v-if="showChrome" />
    <AppDrawer v-if="showChrome" />

    <router-view v-slot="{ Component }">
        <keep-alive>
            <component :is="Component" />
        </keep-alive>
    </router-view>

    <ToastHost />
    <AppDialog />
</template>
