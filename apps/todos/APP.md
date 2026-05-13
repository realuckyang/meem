# todos — 待办

单层任务列表(无子任务嵌套)。

## 后端

- 模块:`server/apps/todos`
- API 前缀:`/apps/todos`
- 表:`apps_todos(id, title, done, sort_order, created_at, updated_at)`

## API

| Method | Path | 说明 |
|---|---|---|
| GET    | `/apps/todos` | 列表(未完成在前) |
| POST   | `/apps/todos` | 新建(body `{title}`) |
| PATCH  | `/apps/todos/:id` | 改 title / done / sort_order |
| DELETE | `/apps/todos/:id` | 删除 |
