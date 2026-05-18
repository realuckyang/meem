const DEFAULT_BRIDGE_HOST = '127.0.0.1';
const DEFAULT_BRIDGE_PORT = 17373;

const bridgeConfig = {
  host: DEFAULT_BRIDGE_HOST,
  port: DEFAULT_BRIDGE_PORT
};

function normalizeHost(value) {
  const next = String(value || '').trim();
  return next || DEFAULT_BRIDGE_HOST;
}

function normalizePort(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_BRIDGE_PORT;
  }
  return parsed;
}

function getBridgeBaseUrl() {
  return `http://${bridgeConfig.host}:${bridgeConfig.port}`;
}

async function loadBridgeConfig() {
  bridgeConfig.host = normalizeHost(DEFAULT_BRIDGE_HOST);
  bridgeConfig.port = normalizePort(DEFAULT_BRIDGE_PORT);
}

export {
  bridgeConfig,
  getBridgeBaseUrl,
  loadBridgeConfig
};
