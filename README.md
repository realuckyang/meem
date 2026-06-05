# Meem

Meem is a personal AI workstation built on a Cloudflare Worker, a local computer client, and a browser extension.

It gives the owner one surface:

```text
/             Meem console
/apps/:name   internal Meem apps
```

The Worker is the entry point. The console runs agent workflows, coordinates local and browser tools, and can help create, modify, build, and deploy internal apps. There is no public-facing website — the console at `/` requires the owner account.

## Structure

```text
worker/       Cloudflare Worker · REST API + D1 schema.sql + R2 + Room DO + routing
worker/server/meem/ Meem backend · console API + agent + repository + Room DO
worker/ui/meem/ Meem console frontend · React + Vite + TS
worker/ui/meem/src/apps/ all Meem apps, including chat · mounted under /apps/:name
worker/ui/meem/src/system/ global Meem shell · topbar, app panel, route state, shared clients
client/       local computer client · shell/files/screenshot/system/computer control
client/system/ local client runtime · WebSocket lifecycle and shared utilities
client/apps/ local client apps · terminal/files/status/computer tools
extension/    Chrome MV3 extension · browser tools
dev/          reference material
```

## Runtime

- `worker/ui/meem` connects to `/ws?client=meem`.
- `client` connects to `/ws?client=client` and executes computer tools.
- `extension` connects to `/ws?client=extension` and executes browser tools.
- `worker` routes console traffic, API requests, WebSocket connections, and static assets.

## Prerequisites

- Node.js 18+ (the local client is tested on Node 22)
- A Cloudflare account (the free tier is enough for personal use)
- An OpenAI-compatible LLM endpoint + API key

## Quick start

### 1. Configure the Worker

```bash
cp worker/wrangler.example.jsonc worker/wrangler.jsonc
```

Fill in your Cloudflare `account_id`, the custom domain/route, the D1 `database_id`,
the R2 bucket, and the LLM values. Real config files (`wrangler.jsonc`,
`extension/config.js`, `client/config.js`) are git-ignored — only the `*.example.*`
templates are committed.

```bash
# create the D1 database and R2 bucket (one time)
npx --prefix worker wrangler d1 create meem
npx --prefix worker wrangler r2 bucket create meem
```

### 2. Create the database schema

`worker/schema.sql` is the canonical, clean set of `CREATE TABLE` statements for a
**fresh** database (no `DROP`/migration statements). Run it once against a new D1:

```bash
npm --prefix worker run db:apply-local                                   # local dev DB
npx --prefix worker wrangler d1 execute meem --remote --file=schema.sql  # remote DB
```

To change the schema later, apply the delta directly with
`wrangler d1 execute ... --command "ALTER TABLE ..."` and keep `schema.sql` in sync —
never re-run the whole file against a database that already holds data. See `AGENTS.md`.

### 3. Run the Worker and the local client

```bash
npm --prefix worker install
npm --prefix worker run build:ui   # build the console frontend
npm --prefix worker run dev         # terminal 1 — Worker (deploy with: run deploy)

cd client && npm install && npm start   # terminal 2 — computer client
```

The first time you open `/`, create the owner account, then open Settings and
fill in the LLM endpoint, key and model.

### 4. Load the browser extension (optional)

```bash
cp extension/config.example.js extension/config.js   # set BASE_URL / WS_URL / TOKEN
```

In Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** →
select the `extension/` directory.

## Frontend checks

```bash
npm --prefix worker/ui/meem run check
npm --prefix worker run typecheck
```

## Tool Development

Tool schemas live in `worker/server/meem/ai/tools.ts`.

- Worker-side tools: `worker/server/meem/ai/functions.ts`
- Browser tools: `extension/src/tools/`
- Computer tools: `client/apps/computer/index.js`
