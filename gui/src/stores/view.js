import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useViewStore = defineStore('view', () => {
    const showDrawer = ref(false);

    const navItems = [
        {
            path: '/todo',
            label: 'Todo',
            iconPath: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
        },
        {
            path: '/agent',
            label: '对话',
            iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
        },
        {
            path: '/docs',
            label: '文档',
            iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6',
        },
        {
            path: '/terminal',
            label: '终端',
            iconPath: 'M4 17l6-6-6-6 M12 19h8',
        },
        {
            path: '/files',
            label: '文件',
            iconPath: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
        },
        {
            path: '/screen',
            label: '屏幕',
            iconPath: 'M3 5h18v12H3z M8 21h8 M12 17v4',
        },
    ];

    function toggleDrawer() { showDrawer.value = !showDrawer.value; }
    function closeDrawer() { showDrawer.value = false; }

    return { showDrawer, navItems, toggleDrawer, closeDrawer };
});
