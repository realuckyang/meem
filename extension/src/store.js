// 扩展连接配置 · 三字段(BASE_URL / WS_URL / TOKEN)· 存 chrome.storage.local
//   · 与电脑端 client 一致:从 Meem 安装页复制配置,粘进 popup
//   · config.js 里的 BASE_URL / WS_URL 仅作默认值(预填),实际以这里存的为准

import { BASE_URL, WS_URL } from '../config.js';

const KEYS = ['meem_base', 'meem_ws', 'meem_token'];

export async function getConfig() {
  const v = await chrome.storage.local.get(KEYS);
  return {
    base: (v?.meem_base || BASE_URL || '').trim(),
    ws: (v?.meem_ws || WS_URL || '').trim(),
    token: (v?.meem_token || '').trim(),
  };
}

export async function setConfig({ base, ws, token }) {
  await chrome.storage.local.set({
    meem_base: (base || '').trim(),
    meem_ws: (ws || '').trim(),
    meem_token: (token || '').trim(),
  });
}

export async function clearConfig() {
  await chrome.storage.local.remove(KEYS);
}
