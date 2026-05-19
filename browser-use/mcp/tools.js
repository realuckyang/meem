import browserBridge from './bridge/index.js';

const browserToolDefinitions = [
  {
    name: 'browser_status',
    description: 'Get Meem Browser Bridge status and current active tab information.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        timeoutSeconds: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'browser_open_tab',
    description: 'Open a new inactive tab in the user current Chrome profile, optionally in a specific window.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        active: { type: 'boolean', description: 'Set true only when the user explicitly wants the tab focused. Defaults to false.' },
        windowId: { type: 'number' },
        timeoutSeconds: { type: 'number' },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'browser_tabs',
    description: 'List Chrome tabs, optionally filtered by current window, active state, or windowId.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        currentWindow: { type: 'boolean' },
        active: { type: 'boolean' },
        windowId: { type: 'number' },
        timeoutSeconds: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'browser_activate_tab',
    description: 'Activate a Chrome tab and focus its window.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' },
        timeoutSeconds: { type: 'number' },
      },
      required: ['tabId'],
      additionalProperties: false,
    },
  },
  {
    name: 'browser_close_tab',
    description: 'Close a Chrome tab.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'number' },
        timeoutSeconds: { type: 'number' },
      },
      required: ['tabId'],
      additionalProperties: false,
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate a Chrome tab to a URL.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        tabId: { type: 'number' },
        timeoutSeconds: { type: 'number' },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'browser_evaluate',
    description: 'Evaluate JavaScript in a Chrome tab and return the Chrome DevTools Runtime.evaluate result.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        tabId: { type: 'number' },
        returnByValue: { type: 'boolean' },
        timeoutSeconds: { type: 'number' },
      },
      required: ['code'],
      additionalProperties: false,
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Capture a Chrome tab screenshot, save it locally, and return the absolute file path.',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['png', 'jpeg', 'webp'] },
        tabId: { type: 'number' },
        quality: { type: 'number' },
        captureBeyondViewport: { type: 'boolean' },
        timeoutSeconds: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
];

const browserToolHandlers = {
  async browser_status(args = {}) {
    return browserBridge.status(args);
  },

  async browser_open_tab(args = {}) {
    return browserBridge.openTab(args);
  },

  async browser_tabs(args = {}) {
    return browserBridge.tabs(args);
  },

  async browser_activate_tab(args = {}) {
    return browserBridge.activateTab(args);
  },

  async browser_close_tab(args = {}) {
    return browserBridge.closeTab(args);
  },

  async browser_navigate(args = {}) {
    return browserBridge.navigate(args);
  },

  async browser_evaluate(args = {}) {
    return browserBridge.evaluate(args);
  },

  async browser_screenshot(args = {}) {
    return browserBridge.screenshot(args);
  },
};

async function runBrowserTool(name, args = {}) {
  const handler = browserToolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown browser tool: ${name}`);
  }
  return handler(args);
}

export { browserBridge, browserToolDefinitions, browserToolHandlers, runBrowserTool };
