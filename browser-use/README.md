# Meem Browser Use

Meem Browser Use lets Codex or another MCP client control the user's own Chrome browser.

It has two parts:

- `mcp/`: a stdio MCP server that exposes browser tools.
- `extension/`: a Chrome extension that executes those tools in the user's current Chrome profile.

The MCP server starts the local browser bridge on demand. There is no separate long-running service to start manually.

## How It Works

```text
Codex
  -> MCP server
  -> local loopback bridge
  -> Chrome extension
  -> user's Chrome tabs
```

Codex talks to the MCP server through stdio. The Chrome extension cannot talk to stdio directly, so the MCP server opens a local loopback bridge at `127.0.0.1:17373` when a browser tool is used. The extension polls that bridge, runs the requested browser action, and returns the result.

## Install Dependencies

From this directory:

```bash
npm install
```

From the Meem project root:

```bash
npm --prefix browser-use install
```

## Install The Chrome Extension

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click **Load unpacked**.
4. Select:

```text
/Users/woodchange/Desktop/meem/browser-use/extension
```

After loading, the extension popup should show that the extension is ready. It may still show the local bridge as offline until Codex starts the MCP server.

## Register The MCP Server

Register the MCP server with Codex:

```bash
codex mcp add meem-browser-bridge -- node /Users/woodchange/Desktop/meem/browser-use/mcp/server.js
```

For another checkout, replace the path with:

```bash
codex mcp add meem-browser-bridge -- node /absolute/path/to/meem/browser-use/mcp/server.js
```

Restart Codex after registering the MCP server so the browser tools are loaded.

## Use It

Once both parts are installed, ask Codex to use the browser. Codex can then call these MCP tools:

- `browser_status`: get bridge status and active tab information.
- `browser_open_tab`: open a new Chrome tab.
- `browser_tabs`: list Chrome tabs.
- `browser_activate_tab`: activate a tab.
- `browser_close_tab`: close a tab.
- `browser_navigate`: navigate a tab.
- `browser_evaluate`: evaluate JavaScript in a tab.
- `browser_screenshot`: capture a tab screenshot and return a local file path.

The screenshot tool writes files to the system temp directory by default:

```text
/tmp/meem-browser-bridge-screenshots
```

## Health Check

The extension popup includes a health check for the local bridge.

- If Codex has not used a browser tool yet, the health check may fail. That is expected.
- When Codex starts the MCP server and calls a browser tool, the local bridge becomes available.
- If a browser tool times out, confirm the extension is enabled and the MCP server is registered in Codex.

## Configuration

Default local bridge address:

```text
http://127.0.0.1:17373
```

Environment variables:

```bash
BROWSER_MCP_BRIDGE_HOST=127.0.0.1
BROWSER_MCP_BRIDGE_PORT=17373
BROWSER_MCP_SCREENSHOT_DIR=/absolute/path
```

If the host or port changes, update `extension/src/config.js` before reloading the unpacked extension.

## Development

Run syntax checks:

```bash
npm run check
```

Start the MCP server directly:

```bash
npm run mcp
```

Direct startup is useful for development, but normal Codex usage should let Codex start the MCP server from its MCP configuration.

## Security

The local bridge only accepts loopback requests. The Chrome extension can access the user's current Chrome session, including logged-in pages. Install it only when you trust the MCP client that will call it.

The extension uses Chrome's `debugger` permission for navigation, JavaScript evaluation, and screenshots.
