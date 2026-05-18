import { bridgeConfig, getBridgeBaseUrl } from './config.js';
import { queryActiveTab } from './tabs.js';

let bridgeStatus = {
  connected: false,
  lastError: null,
  lastHeartbeatAt: null
};

async function requestBridge(path, options = {}) {
  const response = await fetch(`${getBridgeBaseUrl()}${path}`, options);
  if (!response.ok) {
    throw new Error(`Bridge returned ${response.status}.`);
  }
  return response.json();
}

async function postBridge(path, payload) {
  return requestBridge(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function setBridgeError(error) {
  bridgeStatus = {
    connected: false,
    lastError: error?.message || String(error),
    lastHeartbeatAt: bridgeStatus.lastHeartbeatAt
  };
}

function setBridgeSuccess() {
  bridgeStatus = {
    connected: true,
    lastError: null,
    lastHeartbeatAt: new Date().toISOString()
  };
}

async function registerBridge() {
  try {
    await postBridge('/extension/register', {
      id: chrome.runtime.id,
      version: chrome.runtime.getManifest().version,
      name: chrome.runtime.getManifest().name
    });
    setBridgeSuccess();
  } catch (error) {
    setBridgeError(error);
  }
}

async function heartbeatBridge() {
  try {
    const tab = await queryActiveTab().catch(() => null);
    await postBridge('/extension/heartbeat', {
      tab: tab ? {
        id: tab.id,
        url: tab.url || '',
        title: tab.title || ''
      } : null
    });
    setBridgeSuccess();
  } catch (error) {
    setBridgeError(error);
  }
}

async function reportCommandResult(id, body) {
  await postBridge(`/commands/${id}/result`, body);
}

async function checkBridgeHealth() {
  const health = await requestBridge('/health');
  setBridgeSuccess();
  return health;
}

async function getStatusPayload() {
  const tab = await queryActiveTab();
  return {
    ok: true,
    tabId: tab.id,
    tabUrl: tab.url || '',
    tabTitle: tab.title || '',
    bridge: {
      ...bridgeStatus,
      ...bridgeConfig,
      baseUrl: getBridgeBaseUrl()
    }
  };
}

export {
  checkBridgeHealth,
  getStatusPayload,
  heartbeatBridge,
  registerBridge,
  reportCommandResult,
  requestBridge,
  setBridgeError
};
