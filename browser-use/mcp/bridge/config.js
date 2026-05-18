import os from 'node:os';
import path from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 17373;
const DEFAULT_COMMAND_TIMEOUT_MS = 15000;
const DEFAULT_SCREENSHOT_DIR = path.join(os.tmpdir(), 'meem-browser-bridge-screenshots');

function normalizeHost(value) {
  const next = String(value || '').trim();
  return next || DEFAULT_HOST;
}

function normalizePort(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PORT;
  }
  return parsed;
}

function bridgeHost(options = {}) {
  return normalizeHost(
    options.host ||
    process.env.BROWSER_MCP_BRIDGE_HOST ||
    DEFAULT_HOST
  );
}

function bridgePort(options = {}) {
  return normalizePort(
    options.port ||
    process.env.BROWSER_MCP_BRIDGE_PORT ||
    DEFAULT_PORT
  );
}

function screenshotDir(options = {}) {
  const next = String(
    options.screenshotDir ||
    process.env.BROWSER_MCP_SCREENSHOT_DIR ||
    DEFAULT_SCREENSHOT_DIR
  ).trim();
  return next || DEFAULT_SCREENSHOT_DIR;
}

function timeoutMsFromSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_COMMAND_TIMEOUT_MS;
  }
  return Math.max(1, seconds) * 1000;
}

function createBridgeConfig(options = {}) {
  const host = bridgeHost(options);
  const port = bridgePort(options);
  return {
    host,
    port,
    commandTimeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    screenshotDirectory: screenshotDir(options),
    serviceUrl: `http://${host}:${port}`,
  };
}

export {
  DEFAULT_COMMAND_TIMEOUT_MS,
  createBridgeConfig,
  timeoutMsFromSeconds,
};
