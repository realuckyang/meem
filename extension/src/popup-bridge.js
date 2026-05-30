// popup ↔ background 通信 · 登录 / 状态 / 登出
//   · 登录成功 → setToken → reconnect()

import { BASE_URL } from '../config.js';
import { getToken, setToken, clearToken } from './token.js';
import { bridgeState, reconnect, lastConnectedAt, lastDisconnectedAt, lastError } from './ws.js';

async function popupStatus() {
  const token = await getToken();
  return {
    hasToken: !!token,
    bridge: bridgeState(),
    ready: bridgeState() === 'connected',
    extensionId: chrome.runtime.id,
    version: chrome.runtime.getManifest().version,
    lastConnectedAt,
    lastDisconnectedAt,
    lastError,
    baseUrl: BASE_URL,
  };
}

function authError(error) {
  const map = {
    not_configured: '请先在 Meem 控制台设置密码',
    unauthorized: '密码不正确',
    password_too_short: '密码长度不足',
  };
  return map[error] || error || '登录失败';
}

async function handleLogin(password) {
  const r = await fetch(`${BASE_URL}/meem/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(authError(data?.error));
  await setToken(data.token);
  reconnect();
  return { user: data.user };
}

async function handleLogout() {
  await clearToken();
  reconnect(); // 触发一次 connect · 无 token 会自然不连
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'meem.popup-status') {
    popupStatus().then((data) => sendResponse({ ok: true, data }));
    return true;
  }
  if (message.type === 'meem.login') {
    handleLogin(message.password)
      .then((r) => sendResponse({ ok: true, data: r }))
      .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
    return true;
  }
  if (message.type === 'meem.logout') {
    handleLogout().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
