async function queryActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }
  return tab;
}

function tabPayload(tab) {
  return {
    id: tab.id,
    active: Boolean(tab.active),
    windowId: tab.windowId,
    url: tab.url || '',
    title: tab.title || '',
    favIconUrl: tab.favIconUrl || ''
  };
}

async function queryTabs(payload = {}) {
  const query = {};
  if (typeof payload.currentWindow === 'boolean') {
    query.currentWindow = payload.currentWindow;
  }
  if (typeof payload.active === 'boolean') {
    query.active = payload.active;
  }
  if (Number.isFinite(Number(payload.windowId))) {
    query.windowId = Number(payload.windowId);
  }
  const tabs = await chrome.tabs.query(query);
  return tabs.map(tabPayload);
}

async function resolveTargetTab(payload = {}) {
  const tabId = Number(payload.tabId);
  if (Number.isFinite(tabId) && tabId > 0) {
    return chrome.tabs.get(tabId);
  }
  return queryActiveTab();
}

async function activateTab(tabId) {
  const tab = await chrome.tabs.update(tabId, { active: true });
  if (Number.isFinite(Number(tab.windowId))) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  }
  return tabPayload(tab);
}

export {
  activateTab,
  queryActiveTab,
  queryTabs,
  resolveTargetTab,
  tabPayload
};
