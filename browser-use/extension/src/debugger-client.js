const DEBUGGER_VERSION = '1.3';
const attachedTabs = new Set();

function getTarget(tabId) {
  return { tabId };
}

async function ensureDebuggerAttached(tabId) {
  if (attachedTabs.has(tabId)) {
    return;
  }

  await chrome.debugger.attach(getTarget(tabId), DEBUGGER_VERSION);
  attachedTabs.add(tabId);
}

async function sendDebuggerCommand(tabId, method, commandParams = {}) {
  await ensureDebuggerAttached(tabId);
  return chrome.debugger.sendCommand(getTarget(tabId), method, commandParams);
}

async function navigate(tabId, url) {
  await sendDebuggerCommand(tabId, 'Page.enable');
  return sendDebuggerCommand(tabId, 'Page.navigate', { url });
}

async function evaluate(tabId, expression, returnByValue = true) {
  return sendDebuggerCommand(tabId, 'Runtime.evaluate', {
    expression,
    returnByValue
  });
}

function normalizeScreenshotFormat(value) {
  const format = String(value || '').trim().toLowerCase();
  return ['png', 'jpeg', 'webp'].includes(format) ? format : 'png';
}

function normalizeScreenshotQuality(value) {
  const quality = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(quality)) return null;
  return Math.max(0, Math.min(100, quality));
}

async function captureScreenshot(tabId, payload = {}) {
  await sendDebuggerCommand(tabId, 'Page.enable');
  const format = normalizeScreenshotFormat(payload.format);
  const params = {
    format,
    fromSurface: payload.fromSurface !== false
  };
  const quality = normalizeScreenshotQuality(payload.quality);
  if (format === 'jpeg' && quality !== null) {
    params.quality = quality;
  }
  if (typeof payload.captureBeyondViewport === 'boolean') {
    params.captureBeyondViewport = payload.captureBeyondViewport;
  }
  return sendDebuggerCommand(tabId, 'Page.captureScreenshot', params);
}

function handleDebuggerDetach(source) {
  if (typeof source.tabId === 'number') {
    attachedTabs.delete(source.tabId);
  }
}

export {
  captureScreenshot,
  evaluate,
  handleDebuggerDetach,
  navigate,
  normalizeScreenshotFormat
};
