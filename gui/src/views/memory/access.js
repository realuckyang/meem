const accessOptions = [
    { value: 'none', label: '只存', desc: '只保存，AI 不读取' },
    { value: 'summary', label: '星标', desc: 'AI 读摘要' },
    { value: 'full', label: '必读', desc: 'AI 读正文' },
];

function accessLabel(access) {
    return accessOptions.find((item) => item.value === access)?.label || '只存';
}

function accessStyle(access) {
    if (access === 'full') {
        return 'background-color: color-mix(in srgb, var(--color-accent) 22%, transparent); border-color: color-mix(in srgb, var(--color-accent) 50%, transparent); color: var(--color-good);';
    }
    if (access === 'summary') {
        return 'background-color: color-mix(in srgb, var(--color-link) 18%, transparent); border-color: color-mix(in srgb, var(--color-link) 50%, transparent); color: var(--color-link-hi);';
    }
    return 'background-color: transparent; border-color: var(--color-line-hi); color: var(--color-muted);';
}

// 旧 API 兼容：返回空，仅供仍引用 accessClass 的视图调用
function accessClass() { return ''; }

export { accessClass, accessLabel, accessOptions, accessStyle };
