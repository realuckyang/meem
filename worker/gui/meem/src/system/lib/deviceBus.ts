// 设备增删改后通知各处(中控台设备列表)刷新。
const subs = new Set<() => void>();
export function onDevicesChanged(cb: () => void): () => void { subs.add(cb); return () => subs.delete(cb); }
export function notifyDevicesChanged(): void { subs.forEach((s) => s()); }
