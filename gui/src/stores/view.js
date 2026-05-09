import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useViewStore = defineStore('view', () => {
    const showDrawer = ref(false);

    const navItems = [
        {
            path: '/home',
            label: '主页',
            iconPath: 'M3 10.5 12 3l9 7.5 M5 10v10h14V10 M9 20v-6h6v6',
        },
        {
            path: '/activity',
            label: '动态',
            iconPath: 'M3 12h4l3 8 4-16 3 8h4',
        },
        {
            path: '/memory',
            label: '记忆',
            iconPath: 'M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.4 3 5.7V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3a7 7 0 0 0-4-12.7z M9 10h.01 M15 10h.01 M10 14h4',
        },
        {
            path: '/docs',
            label: '文档',
            iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6',
        },
        {
            path: '/files',
            label: '文件',
            iconPath: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
        },
        {
            path: '/terminal',
            label: '终端',
            iconPath: 'M4 17l6-6-6-6 M12 19h8',
        },
        {
            path: '/screen',
            label: '屏幕',
            iconPath: 'M3 5h18v12H3z M8 21h8 M12 17v4',
        },
        {
            path: '/agent',
            label: '对话',
            iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
        },
    ];

    function toggleDrawer() { showDrawer.value = !showDrawer.value; }
    function closeDrawer() { showDrawer.value = false; }

    return { showDrawer, navItems, toggleDrawer, closeDrawer };
});
