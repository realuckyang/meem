#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runBrowserTool, browserToolDefinitions, browserBridge } from './tools.js';

const SERVER_INFO = {
  name: 'meem-browser-bridge',
  version: '0.1.0',
};

const server = new Server(SERVER_INFO, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
});

function logError(error) {
  process.stderr.write(`[meem-browser-bridge] ${error?.stack || error?.message || String(error)}\n`);
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: 'Result is not JSON serializable.',
      detail: error?.message || String(error),
    }, null, 2);
  }
}

function textContent(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : safeStringify(value),
      },
    ],
  };
}

function toMcpTools() {
  return browserToolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  }));
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toMcpTools(),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = String(request.params?.name || '');
  const args = request.params?.arguments || {};

  try {
    const result = await runBrowserTool(name, args);
    return textContent(result);
  } catch (error) {
    logError(error);
    return {
      isError: true,
      ...textContent(error?.message || String(error)),
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [],
}));

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [],
}));

async function shutdown() {
  try {
    await browserBridge.stop();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (error) {
  logError(error);
  await shutdown();
}
