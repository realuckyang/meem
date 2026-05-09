---
name: meem
description: Use the Meem HTTP API when an agent needs to manage the user's local Todos, Documents (folders + notes), browse local Files, or capture the desktop screen on the machine running Meem.
---

# Meem Skill

This skill describes how an agent should interact with the Meem instance running on the user's machine.

## Purpose

Meem is the user's local "second brain + workspace": Todos, Documents (folders + notes), Files browser, screen snapshot. All data lives in local SQLite — there is no cloud, no auth across the network.

Use this skill when the user asks the agent to:

- Add / list / update / complete / delete Todos
- Read, create, edit, organize Documents and folders
- Browse, read, upload, rename, or delete local Files
- Take a desktop screenshot

Do NOT use this skill for:

- Web automation on the user's logged-in browser → use the `meem-browser` skill
- Terminal commands or remote-access scenarios → not in scope

## Connection

- Base URL: `http://127.0.0.1:9001` (default; the user may have changed `HTTP_HOST` / `HTTP_PORT` in `server/config.js`)
- No auth header needed — Meem listens on localhost only
- All request and response bodies are JSON unless noted

If a request fails with `ECONNREFUSED`, Meem is not running. Tell the user to start it: `cd /path/to/meem && npm start`.

## API Surface

### Tasks — `/api/tasks`

A task is a card stack. Title + an ordered list of `turns` (each turn is a card with `role: user | ai`, markdown `content`, optional `suggestions`). The first user turn is the task description; later turns are AI replies and user follow-ups.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET  | `/api/tasks`              |                                   | List tasks (each carries `latest_turn` for preview) |
| POST | `/api/tasks`              | `{ "title", "description"? }`     | Create. `description` becomes the first user turn |
| GET  | `/api/tasks/:id`          |                                   | Read full task incl. ordered `turns` array (oldest first) |
| PATCH| `/api/tasks/:id`          | `{ "title"?, "status"? }`         | status ∈ `open | done` |
| DELETE | `/api/tasks/:id`        |                                   | Delete (cascades turns) |
| POST | `/api/tasks/:id/turns`    | `{ "role": "ai\|user", "content": "...", "suggestions"?: ["...", "..."] }` | Append a turn. `suggestions` is an optional array of short next-step prompts (only meaningful for `ai` turns) — the user can tap one to spawn the next user turn. |

**When you (an AI) are working on a task:**
1. `GET /api/tasks/:id` — read the title and turns
2. Use the first user turn as the brief, walk through later turns to understand context
3. Do the work, then `POST /api/tasks/:id/turns` with `{ role: "ai", content: "<markdown>", suggestions: ["...", "..."] }`
4. Suggestions should be 1-3 short, action-flavored prompts (e.g. "改用 Vue 重写", "加上单元测试", "解释为什么这么做") that the user might want to send back as the next round.

### Todos — `/api/todos`

| Method | Path | Body | Notes |
|---|---|---|---|
| GET  | `/api/todos`        |                          | List all todos |
| POST | `/api/todos`        | `{ "title": "..." }`     | Create |
| GET  | `/api/todos/:id`    |                          | Read one |
| PATCH| `/api/todos/:id`    | `{ "title"?, "done"? }`  | Update title or completion state |
| DELETE | `/api/todos/:id`  |                          | Delete |

### Documents — `/api/docs`

Two object types: **folders** (containers, infinite nesting) and **docs** (notes with markdown body).

| Method | Path | Body | Notes |
|---|---|---|---|
| GET  | `/api/docs/list?folderId=<id\|empty>`  |                                                | List folders + docs in a folder. Empty `folderId` = root |
| GET  | `/api/docs/breadcrumb?folderId=<id>`   |                                                | Breadcrumb chain for a folder |
| POST | `/api/docs/folders`                    | `{ "name": "...", "parent_id"?: <id> }`        | Create folder |
| PATCH| `/api/docs/folders/:id`                | `{ "name"?, "parent_id"? }`                    | Rename or move |
| DELETE | `/api/docs/folders/:id`              |                                                | Delete (recursive) |
| GET  | `/api/docs/:id`                        |                                                | Read full doc (with content) |
| POST | `/api/docs`                            | `{ "folder_id": <id\|null>, "title": "...", "content": "..." }` | Create doc |
| PATCH| `/api/docs/:id`                        | `{ "title"?, "content"?, "folder_id"? }`       | Update |
| DELETE | `/api/docs/:id`                      |                                                | Delete |

### Files — `/api/fs`

Operates on the local filesystem within the user's home directory (boundary enforced server-side).

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/fs/home`                                         | Get the user's home directory absolute path |
| GET  | `/api/fs/list?path=<rel>&showHidden=0\|1`              | List directory contents |
| GET  | `/api/fs/stat?path=<rel>`                              | File / directory metadata |
| GET  | `/api/fs/read?path=<rel>&maxSize=<bytes>`              | Read file (text/binary metadata + base64 content for small files) |
| POST | `/api/fs/mkdir`  body `{ "path": "<rel>" }`            | Create directory |
| POST | `/api/fs/rename` body `{ "from": "<rel>", "to": "<rel>" }` | Rename / move |
| POST | `/api/fs/upload` (multipart `file=` + form `path=<rel>`) | Upload file (max 200MB) |
| DELETE | `/api/fs` body `{ "path": "<rel>" }`                 | Delete file or directory |

### Screen — `/api/screen`

| Method | Path | Notes |
|---|---|---|
| GET  | `/api/screen/snapshot` | Returns `image/png` binary of the current desktop. Use sparingly — captures whatever is on screen, including private content |

## Recipes

### Capture multiple memos as a batch into a folder

```bash
# Create folder
FID=$(curl -s -X POST http://127.0.0.1:9001/api/docs/folders \
  -H "Content-Type: application/json" \
  -d '{"name":"Meeting notes 2026-05-08"}' | jq -r .id)

# Add docs
curl -s -X POST http://127.0.0.1:9001/api/docs \
  -H "Content-Type: application/json" \
  -d "{\"folder_id\":$FID,\"title\":\"Decisions\",\"content\":\"...\"}"
```

### Add a list of todos in one go

```bash
for t in "task A" "task B" "task C"; do
  curl -s -X POST http://127.0.0.1:9001/api/todos \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"$t\"}"
done
```

### Read a local file safely

Always pass `path` relative to the user's home (e.g. `Desktop/foo.txt`). Use `stat` first if the file may be very large; pass `maxSize` to `read` to bound memory.

## Behavioral notes

- **Idempotency:** Document and folder names are not unique. Creating "Notes" twice will yield two folders. Check existence with `/list` before creating if dedupe matters.
- **Deletion:** `DELETE /api/docs/folders/:id` is recursive — it removes the folder and everything inside. Confirm with the user before issuing.
- **Long content:** When creating docs with markdown bodies, use proper JSON escaping (newlines as `\n`, quotes escaped). Prefer `jq -Rn --arg c "$CONTENT" '$c'` in shell.
- **Privacy:** Screen snapshots and file reads can leak sensitive content. Don't take them without explicit user request.
- **Resilience:** Meem is single-process local — if it stops, all `/api/*` requests fail. Don't retry blindly; tell the user.
