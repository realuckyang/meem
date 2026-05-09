import { createRouter, createWebHistory } from 'vue-router';
import { useWsStore } from '@/stores/ws';
import ActivityView from './views/ActivityView.vue';
import HomeView from './views/HomeView.vue';
import MemoryView from './views/MemoryView.vue';
import MemoryFormView from './views/memory/MemoryFormView.vue';

const routes = [
    { path: '/', redirect: '/home' },
    {
        path: '/guard',
        name: 'guard',
        meta: { public: true },
        component: () => import('./views/GuardView.vue'),
    },
    {
        path: '/terminal',
        name: 'terminal',
        component: () => import('./views/TerminalView.vue'),
    },
    {
        path: '/home',
        name: 'home',
        component: HomeView,
    },
    {
        path: '/activity',
        name: 'activity',
        component: ActivityView,
    },
    {
        path: '/memory',
        name: 'memory',
        component: MemoryView,
    },
    {
        path: '/memory/new',
        name: 'memory-new',
        component: MemoryFormView,
    },
    {
        path: '/memory/:id',
        name: 'memory-detail',
        component: MemoryFormView,
    },
    {
        path: '/files',
        name: 'files',
        component: () => import('./views/FilesView.vue'),
    },
    {
        path: '/screen',
        name: 'screen',
        component: () => import('./views/ScreenView.vue'),
    },
    {
        path: '/agent',
        name: 'agent',
        component: () => import('./views/AgentView.vue'),
    },
    {
        path: '/docs',
        name: 'docs',
        component: () => import('./views/docs/DocsView.vue'),
    },
    {
        path: '/settings',
        name: 'settings',
        component: () => import('./views/SettingsView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to) => {
    if (to.meta?.public) return true;
    const ws = useWsStore();
    if (ws.requiresPassword && !ws.authenticated) {
        return { path: '/guard' };
    }
    return true;
});
