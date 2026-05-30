# Meem

Meem is an AI application framework built on a Cloudflare Worker, a local computer client, and a browser extension.

It gives a user three surfaces:

```text
/                 public website
/meem             Meem console
/meem/apps/:name  internal Meem apps
```

The Worker is the public entry point. The console runs agent workflows, coordinates local and browser tools, and can help create, modify, build, and deploy the public website and internal apps.

## Structure

```text
worker/       Cloudflare Worker · REST API + D1 schema.sql + R2 + Room DO + routing
worker/server/meem/ Meem backend · console API + agent + repository + Room DO
worker/server/site/ public site backend · public forms and visitor interaction
worker/gui/site/ public website source · mounted at /
worker/gui/meem/ Meem console frontend · React + Vite + TS
worker/gui/meem/src/apps/ all Meem apps, including chat · mounted under /meem/apps/:name
worker/gui/meem/src/system/ global Meem shell · topbar, app panel, route state, shared clients
client/       local computer client · shell/files/screenshot/system/computer control
extension/    Chrome MV3 extension · browser tools
dev/          reference material
```

## Runtime

- `worker/gui/meem` connects to `/meem/ws?client=meem`.
- `client` connects to `/meem/ws?client=client` and executes computer tools.
- `extension` connects to `/meem/ws?client=extension` and executes browser tools.
- `worker` routes public traffic, API requests, WebSocket connections, and static assets.

## Development

```bash
npm --prefix worker/gui/meem install
npm --prefix worker/gui/meem run check
npm --prefix worker run build:gui

npm --prefix worker install
npm --prefix worker run typecheck
npm --prefix worker run dev
npm --prefix worker run deploy
npm --prefix worker run db:apply

cd client
npm install
npm start
```

Copy `worker/wrangler.example.jsonc` to `worker/wrangler.jsonc` and fill real Cloudflare bindings and LLM values. Real config files are ignored.

During development, D1 is rebuilt from `worker/schema.sql`; migration files are intentionally not maintained.

## Tool Development

Tool schemas live in `worker/server/meem/ai/tools.ts`.

- Worker-side tools: `worker/server/meem/ai/functions.ts`
- Browser tools: `extension/src/tools/`
- Computer tools: `client/src/tools.js`
