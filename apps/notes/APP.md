# notes — 笔记

笔记本树 + 笔记。Notion 风的富文本(HTML 存内容)。

## 后端

- 模块:`server/apps/notes`
- API 前缀:`/apps/notebooks`、`/apps/notes`
- 表:
  - `apps_notebooks(id, parent_id, name, icon, cover, sort_order, ...)` — 自引用树
  - `apps_notes(id, notebook_id, title, content, icon, cover, sort_order, ...)`

## API

| Method | Path | 说明 |
|---|---|---|
| GET    | `/apps/notebooks?parent_id=` | 某父下笔记本列表 |
| POST   | `/apps/notebooks` | 新建笔记本 |
| GET    | `/apps/notebooks/:id` | 笔记本详情(含面包屑、子笔记本、笔记) |
| PATCH  | `/apps/notebooks/:id` | 改属性(name/icon/cover/parent_id/sort_order) |
| DELETE | `/apps/notebooks/:id` | 删除(级联子树) |
| POST   | `/apps/notes` | 新建笔记 |
| GET    | `/apps/notes/:id` | 笔记详情(含面包屑) |
| PATCH  | `/apps/notes/:id` | 改属性 |
| DELETE | `/apps/notes/:id` | 删除 |
