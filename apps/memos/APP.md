# memos — 想法

时间轴随手记。短文本,可内嵌 markdown 图片(`![](/i/...)`)。

## 后端

- 模块:`server/apps/memos`
- API 前缀:`/apps/memos`
- 表:`apps_memos(id, content, created_at, updated_at)`

## API

| Method | Path | 说明 |
|---|---|---|
| GET    | `/apps/memos?offset=&limit=` | 列表(按 created_at DESC,分页) |
| POST   | `/apps/memos` | 新建(body `{content}`) |
| PATCH  | `/apps/memos/:id` | 改 content |
| DELETE | `/apps/memos/:id` | 删除 |
