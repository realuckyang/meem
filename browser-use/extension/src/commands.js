import { heartbeatBridge, reportCommandResult, requestBridge, setBridgeError } from './bridge-client.js';
import { captureScreenshot, evaluate, navigate, normalizeScreenshotFormat } from './debugger-client.js';
import { activateTab, queryActiveTab, queryTabs, resolveTargetTab, tabPayload } from './tabs.js';

function requirePositiveTabId(value) {
  const tabId = Number(value);
  if (!Number.isFinite(tabId) || tabId <= 0) {
    throw new Error('Missing payload.tabId.');
  }
  return tabId;
}

async function executeCommand(command, payload = {}) {
  switch (command.type) {
    case 'status': {
      const tab = await queryActiveTab();
      return {
        tabId: tab.id,
        url: tab.url || '',
        title: tab.title || ''
      };
    }
    case 'tabs': {
      const tabs = await queryTabs(payload);
      return { tabs };
    }
    case 'activate-tab': {
      const tabId = requirePositiveTabId(payload?.tabId);
      return { tab: await activateTab(tabId) };
    }
    case 'close-tab': {
      const tabId = requirePositiveTabId(payload?.tabId);
      await chrome.tabs.remove(tabId);
      return { tabId, closed: true };
    }
    case 'open-tab': {
      const url = String(payload?.url || '').trim();
      if (!url) {
        throw new Error('Missing payload.url.');
      }
      const createOptions = {
        url,
        active: payload?.active === true,
      };
      if (Number.isFinite(Number(payload?.windowId))) {
        createOptions.windowId = Number(payload.windowId);
      }
      const tab = await chrome.tabs.create(createOptions);
      return { tabId: tab.id, url: tab.url || url };
    }
    case 'navigate': {
      const tab = await resolveTargetTab(payload);
      const url = String(payload?.url || '').trim();
      if (!url) {
        throw new Error('Missing payload.url.');
      }
      await navigate(tab.id, url);
      return { tabId: tab.id, url };
    }
    case 'evaluate': {
      const tab = await resolveTargetTab(payload);
      const expression = String(payload?.expression || '').trim();
      if (!expression) {
        throw new Error('Missing payload.expression.');
      }
      const result = await evaluate(tab.id, expression, payload?.returnByValue !== false);
      return { tabId: tab.id, evaluation: result };
    }
    case 'screenshot': {
      const tab = await resolveTargetTab(payload);
      const screenshot = await captureScreenshot(tab.id, payload);
      return {
        tabId: tab.id,
        url: tab.url || '',
        title: tab.title || '',
        tab: tabPayload(tab),
        screenshot: {
          format: normalizeScreenshotFormat(payload?.format),
          data: screenshot.data
        }
      };
    }
    default:
      throw new Error(`Unsupported command type: ${command.type}`);
  }
}

async function pullAndRunNextCommand() {
  let next;
  try {
    next = await requestBridge('/commands/next');
  } catch (error) {
    setBridgeError(error);
    return;
  }

  const command = next?.command;
  if (!command) {
    return;
  }

  try {
    const result = await executeCommand(command, next?.payload || {});
    await reportCommandResult(command.id, { ok: true, result });
  } catch (error) {
    await reportCommandResult(command.id, {
      ok: false,
      error: error?.message || String(error)
    }).catch(() => {});
  }
}

async function syncBridge() {
  await heartbeatBridge();
  await pullAndRunNextCommand();
}

export {
  executeCommand,
  pullAndRunNextCommand,
  syncBridge
};
