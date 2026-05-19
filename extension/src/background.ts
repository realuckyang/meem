chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener((tab) => {
  const windowId = tab.windowId;
  if (typeof windowId === 'number') {
    chrome.sidePanel.open({ windowId }).catch(() => {});
  }
});
