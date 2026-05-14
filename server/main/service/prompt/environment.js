// 环境段:让助理知道自己跑在什么地方,数据库在哪。
// cwd 注入,避免硬编码;DB 路径就是 meem 约定的 database/meem.db。
export const environment = (cwd) => `

## 环境
- 工作目录:${cwd}
- 数据库:${cwd}/database/meem.db(SQLite)
  - 应用数据:apps_memos / apps_todos / apps_notebooks / apps_notes
  - 系统:settings / messages / tasks / memories
- shell 工具的命令默认就在这个工作目录下执行,需要时 \`cd\` 进子目录或 \`pwd\` 看一眼。`
