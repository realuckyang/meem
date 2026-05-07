import { createRouter, createWebHistory } from 'vue-router';
import { useWsStore } from '@/stores/ws';

const routes = [
    { path: '/', redirect: '/todo' },
    {
        path: '/guard',
        name: 'guard',
        meta: { public: true },
        component: () => import('./views/GuardView.vue'),
    },
    {
        path: '/todo',
        name: 'todo',
        component: () => import('./views/TodoView.vue'),
    },
    {
        path: '/terminal',
        name: 'terminal',
        component: () => import('./views/TerminalView.vue'),
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
        component: () => import('./views/DocsView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/todo' },
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
