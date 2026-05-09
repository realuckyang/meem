import { defineStore } from 'pinia';
import { ref } from 'vue';

// 全局唯一的 Dialog 状态。两种模式:
//   - confirm: 只问是否
//   - prompt:  让用户输入文字
// 使用方:await useDialogStore().confirm({ title, message, danger }) 等
export const useDialogStore = defineStore('dialog', () => {
    const open = ref(false);
    const mode = ref('confirm');         // 'confirm' | 'prompt'
    const title = ref('');
    const message = ref('');
    const placeholder = ref('');
    const inputValue = ref('');
    const confirmText = ref('确定');
    const cancelText = ref('取消');
    const danger = ref(false);

    let resolver = null;

    function _close(result) {
        open.value = false;
        const r = resolver;
        resolver = null;
        if (r) r(result);
    }

    function confirm({ title: t = '', message: m = '', confirmText: ct = '确定', cancelText: cct = '取消', danger: d = false } = {}) {
        return new Promise((resolve) => {
            mode.value = 'confirm';
            title.value = t;
            message.value = m;
            confirmText.value = ct;
            cancelText.value = cct;
            danger.value = d;
            inputValue.value = '';
            resolver = resolve;
            open.value = true;
        });
    }

    function prompt({ title: t = '', message: m = '', defaultValue = '', placeholder: ph = '', confirmText: ct = '确定', cancelText: cct = '取消' } = {}) {
        return new Promise((resolve) => {
            mode.value = 'prompt';
            title.value = t;
            message.value = m;
            placeholder.value = ph;
            inputValue.value = defaultValue;
            confirmText.value = ct;
            cancelText.value = cct;
            danger.value = false;
            resolver = resolve;
            open.value = true;
        });
    }

    function accept() {
        _close(mode.value === 'prompt' ? inputValue.value : true);
    }

    function dismiss() {
        _close(mode.value === 'prompt' ? null : false);
    }

    return {
        open, mode, title, message, placeholder, inputValue,
        confirmText, cancelText, danger,
        confirm, prompt, accept, dismiss,
    };
});
