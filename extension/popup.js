// Meem extension popup
//   · 登录 / 注册 → background 写 chrome.storage.local 的 meem_token
//   · 已登录 → 显示连接状态 + 提示去 Meem 网页操作

const $ = (id) => document.getElementById(id);

let mode = 'login';

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (r) => resolve(r));
  });
}

async function refresh() {
  const r = await send({ type: 'meem.popup-status' });
  const data = r?.data;
  if (!data) return;

  $('ver').textContent = data.version || '?';
  const site = data.baseUrl || '#';
  $('site-link').href = site;
  $('site-link').textContent = site === '#' ? '打开 Meem' : `打开 ${site.replace(/^https?:\/\//, '')}`;

  if (data.hasToken) {
    $('view-status').hidden = false;
    $('view-auth').hidden = true;

    const dot = $('dot');
    dot.className = 'dot ' + data.bridge;
    const text = {
      connected: '已连接 · 等待 AI 调用',
      connecting: '连接中…',
      reconnecting: '断开 · 重连中',
      disconnected: '未连接',
    }[data.bridge] || data.bridge;
    $('state-text').textContent = text;

    const info = [];
    if (data.lastConnectedAt) info.push(`上次连接 · ${formatTime(data.lastConnectedAt)}`);
    if (data.lastError && data.bridge !== 'connected') info.push(`错误 · ${data.lastError}`);
    $('info').textContent = info.join('\n');
  } else {
    $('view-status').hidden = true;
    $('view-auth').hidden = false;
  }
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch { return iso; }
}

function showError(msg) {
  const el = $('error');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
}

function switchMode(m) {
  mode = m;
  $('tab-login').classList.toggle('active', m === 'login');
  $('tab-register').classList.toggle('active', m === 'register');
  $('btn-submit').textContent = m === 'login' ? '登录' : '注册';
  showError('');
}

document.addEventListener('DOMContentLoaded', () => {
  $('tab-login').addEventListener('click', () => switchMode('login'));
  $('tab-register').addEventListener('click', () => switchMode('register'));

  $('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const handle = $('in-handle').value.trim().toLowerCase();
    const password = $('in-password').value;
    if (mode === 'register' && !/^[a-z][a-z0-9_]{1,23}$/.test(handle)) return showError('账号要以字母开头 · 2-24 位 · 只允许小写字母 / 数字 / _');
    if (password.length < 6) return showError('密码至少 6 位');

    const btn = $('btn-submit');
    btn.disabled = true;
    showError('');
    try {
      const r = await send({ type: 'meem.' + mode, handle, password });
      if (!r?.ok) { showError(r?.error || '失败'); return; }
      await refresh();
    } finally {
      btn.disabled = false;
    }
  });

  $('btn-logout').addEventListener('click', async () => {
    await send({ type: 'meem.logout' });
    setTimeout(refresh, 100);
  });

  refresh();
  // 状态轮询(同时让 popup 一直保持 background 活着)
  setInterval(refresh, 2000);
});
