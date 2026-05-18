import {
  bridgeConfig,
  getBridgeBaseUrl,
  loadBridgeConfig
} from './src/config.js';
import { checkBridgeHealth, getStatusPayload, registerBridge } from './src/bridge-client.js';
import { pullAndRunNextCommand, syncBridge } from './src/commands.js';
import { handleDebuggerDetach } from './src/debugger-client.js';

async function initialize() {
  await loadBridgeConfig();
  chrome.alarms.create('bridge-heartbeat', {
    delayInMinutes: 0.5,
    periodInMinutes: 0.5
  });
  await registerBridge();
  await pullAndRunNextCommand();
}

chrome.debugger.onDetach.addListener(handleDebuggerDetach);

chrome.runtime.onInstalled.addListener(() => {
  initialize();
});

chrome.runtime.onStartup.addListener(() => {
  initialize();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bridge-heartbeat') {
    syncBridge();
  }
});

setInterval(() => {
  syncBridge();
}, 3000);

initialize();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case 'status': {
        sendResponse(await getStatusPayload());
        return;
      }
      case 'get-config': {
        sendResponse({
          ok: true,
          bridge: {
            ...bridgeConfig,
            baseUrl: getBridgeBaseUrl()
          }
        });
        return;
      }
      case 'health-check': {
        sendResponse({
          ok: true,
          health: await checkBridgeHealth()
        });
        return;
      }
      default: {
        throw new Error(`Unsupported message type: ${message?.type ?? 'unknown'}`);
      }
    }
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error?.message || String(error)
    });
  });

  return true;
});
