import { randomUUID } from 'node:crypto';
import { createBridgeConfig, timeoutMsFromSeconds } from './config.js';
import { createBridgeHttpServer } from './http.js';
import { createCommandQueue } from './queue.js';
import { normalizeScreenshotFormat, saveBrowserScreenshot } from './screenshots.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createBrowserBridge(options = {}) {
  const config = createBridgeConfig(options);
  const queue = createCommandQueue();
  const state = {
    serverId: randomUUID(),
    startedAt: null,
    lastRegisterAt: null,
    lastHeartbeatAt: null,
    extension: null,
  };

  function serviceUrl() {
    return config.serviceUrl;
  }

  function snapshot() {
    return {
      serverId: state.serverId,
      host: config.host,
      port: config.port,
      serviceUrl: serviceUrl(),
      startedAt: state.startedAt,
      lastRegisterAt: state.lastRegisterAt,
      lastHeartbeatAt: state.lastHeartbeatAt,
      extension: state.extension,
      commands: queue.snapshot(),
    };
  }

  const httpServer = createBridgeHttpServer({
    config,
    state,
    queue,
    snapshot,
  });

  async function waitForCommand(id, timeoutMs = config.commandTimeoutMs) {
    const deadline = Date.now() + Math.max(1000, timeoutMs);

    while (Date.now() < deadline) {
      const command = queue.findCommand(id);
      if (!command) {
        throw new Error('Browser command disappeared.');
      }
      if (command.status === 'completed') return command.result;
      if (command.status === 'failed') {
        throw new Error(command.error || 'Browser command failed.');
      }
      await wait(250);
    }

    throw new Error('Browser command timed out.');
  }

  async function runCommand(type, payload = {}, { timeoutMs = config.commandTimeoutMs } = {}) {
    await start();
    const command = queue.createCommand(type, payload);
    return waitForCommand(command.id, timeoutMs);
  }

  function start() {
    return httpServer.start();
  }

  function stop() {
    return httpServer.stop();
  }

  async function openTab({ url, active = false, windowId, timeoutSeconds } = {}) {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) throw new Error('url is required');
    return runCommand('open-tab', { url: targetUrl, active: active === true, windowId }, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });
  }

  async function status({ timeoutSeconds = 6 } = {}) {
    await start();
    const result = await runCommand('status', {}, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });
    return {
      bridge: snapshot(),
      tab: result,
    };
  }

  async function tabs({ currentWindow, active, windowId, timeoutSeconds } = {}) {
    return runCommand('tabs', {
      currentWindow,
      active,
      windowId,
    }, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });
  }

  async function activateTab({ tabId, timeoutSeconds } = {}) {
    const targetTabId = Number(tabId);
    if (!Number.isFinite(targetTabId) || targetTabId <= 0) {
      throw new Error('tabId is required');
    }
    return runCommand('activate-tab', { tabId: targetTabId }, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });
  }

  async function closeTab({ tabId, timeoutSeconds } = {}) {
    const targetTabId = Number(tabId);
    if (!Number.isFinite(targetTabId) || targetTabId <= 0) {
      throw new Error('tabId is required');
    }
    return runCommand('close-tab', { tabId: targetTabId }, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });
  }

  async function navigate({ url, tabId, timeoutSeconds } = {}) {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) throw new Error('url is required');
    return runCommand('navigate', { url: targetUrl, tabId }, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });
  }

  async function evaluate({ code, tabId, returnByValue = true, timeoutSeconds } = {}) {
    const expression = String(code || '').trim();
    if (!expression) throw new Error('code is required');
    return runCommand('evaluate', { expression, tabId, returnByValue }, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });
  }

  async function screenshot({ tabId, format = 'png', quality, captureBeyondViewport, timeoutSeconds } = {}) {
    const nextFormat = normalizeScreenshotFormat(format);
    const result = await runCommand('screenshot', {
      tabId,
      format: nextFormat,
      quality,
      captureBeyondViewport,
    }, {
      timeoutMs: timeoutMsFromSeconds(timeoutSeconds),
    });

    return saveBrowserScreenshot(result, {
      directory: config.screenshotDirectory,
      format: nextFormat,
    });
  }

  return {
    start,
    stop,
    snapshot,
    serviceUrl,
    runCommand,
    status,
    tabs,
    activateTab,
    closeTab,
    openTab,
    navigate,
    evaluate,
    screenshot,
  };
}

const browserBridge = createBrowserBridge();

export { createBrowserBridge, browserBridge };
export default browserBridge;
