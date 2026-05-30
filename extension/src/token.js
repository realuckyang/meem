// chrome.storage.local 里的 meem_token · popup 登录写入 · ws 连接读取

export async function getToken() {
  const v = await chrome.storage.local.get('meem_token');
  return v?.meem_token || '';
}

export async function setToken(token) {
  await chrome.storage.local.set({ meem_token: token });
}

export async function clearToken() {
  await chrome.storage.local.remove('meem_token');
}
