const GITHUB_URL = 'https://github.com/realuckyang/meem-browser-bridge';

const mcpAddressEl = document.getElementById('mcp-address');
const tabStatusEl = document.getElementById('tab-status');
const healthStatusEl = document.getElementById('health-status');
const healthDetailEl = document.getElementById('health-detail');
const healthButton = document.getElementById('health-check');

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || 'Unknown extension error.');
  }
  return response;
}

function setHealth(state, label, detail) {
  healthStatusEl.className = `pill ${state}`;
  healthStatusEl.textContent = label;
  healthDetailEl.textContent = detail;
}

function renderRows(rows) {
  tabStatusEl.innerHTML = rows.map((row) => `
    <div class="row">
      <span class="label">${escapeHtml(row.label)}</span>
      <span class="value">${escapeHtml(row.value)}</span>
    </div>
  `).join('');
}

function renderStatus(response) {
  mcpAddressEl.textContent = response.bridge?.baseUrl || 'n/a';
  renderRows([
    {
      label: 'Tab ID',
      value: String(response.tabId ?? 'n/a')
    },
    {
      label: 'Title',
      value: response.tabTitle || 'Empty'
    },
    {
      label: 'URL',
      value: response.tabUrl || 'Empty'
    },
    {
      label: 'Last Seen',
      value: response.bridge?.lastHeartbeatAt || 'No bridge heartbeat yet'
    }
  ]);

  if (response.bridge?.connected) {
    setHealth('ready', 'Bridge online', 'MCP server is reachable.');
    return;
  }

  setHealth('idle', 'Bridge offline', 'Open Codex and use a browser tool to start MCP.');
}

function renderStatusUnavailable(error) {
  mcpAddressEl.textContent = 'n/a';
  renderRows([
    {
      label: 'Status',
      value: error?.message || 'Status unavailable'
    }
  ]);
  setHealth('error', 'Unavailable', 'Extension status could not be read.');
}

async function refreshStatus() {
  try {
    renderStatus(await send('status'));
  } catch (error) {
    renderStatusUnavailable(error);
  }
}

async function runHealthCheck() {
  healthButton.disabled = true;
  healthButton.textContent = 'Checking';
  setHealth('idle', 'Checking', 'Looking for the local bridge.');

  try {
    const response = await send('health-check');
    const url = response.health?.serviceUrl || response.health?.host || 'local bridge';
    setHealth('ready', 'Bridge online', String(url));
    await refreshStatus();
  } catch (error) {
    setHealth('idle', 'Bridge offline', 'Start the MCP server from Codex, then check again.');
  } finally {
    healthButton.disabled = false;
    healthButton.textContent = 'Check';
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

healthButton.addEventListener('click', runHealthCheck);

document.querySelectorAll('a[href^="https://github.com/"]').forEach((link) => {
  if (!link.href.startsWith(GITHUB_URL)) {
    link.href = GITHUB_URL;
  }
});

refreshStatus();
