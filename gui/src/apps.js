// 应用注册表 —— 单一事实源。
// AppShell 用它生成宫格面板,router 用它生成路由,后续新加应用只改这里。
//
// 每个应用对象:
//   id           应用 id(英文)
//   icon         emoji
//   label        中文展示名
//   path         主入口 path
//   match(p)     判断某个 url 是否属于这个应用(供 AppShell 高亮当前应用 / 顶栏标题用)
//   component    主入口的懒加载 import
//   subRoutes    可选:同一个应用下其它路由(只在 router 用)
//   inLauncher   可选 false 表示不在宫格面板里(仅作为路由存在,例如「设置」内部子页)

export const apps = [
  {
    id: 'assistant', icon: '💬', label: '聊天',
    path: '/assistant',
    match: (p) => p === '/assistant',
    component: () => import('./apps/assistant/Assistant.vue'),
  },
  {
    id: 'memos', icon: '💡', label: '想法',
    path: '/memos',
    match: (p) => p.startsWith('/memos'),
    component: () => import('./apps/memos/Memos.vue'),
  },
  {
    id: 'todos', icon: '✅', label: '待办',
    path: '/todos',
    match: (p) => p.startsWith('/todos'),
    component: () => import('./apps/todos/Todos.vue'),
  },
  {
    id: 'notes', icon: '📚', label: '笔记',
    path: '/notes',
    match: (p) => p.startsWith('/notes') || p.startsWith('/notebook') || p.startsWith('/note'),
    component: () => import('./apps/notes/Home.vue'),
    subRoutes: [
      { path: '/notebook/:id', name: 'notebook', component: () => import('./apps/notes/Notebook.vue'), props: true },
      { path: '/note/:id',     name: 'note',     component: () => import('./apps/notes/Note.vue'),     props: true },
    ],
  },
  {
    id: 'search', icon: '🔍', label: '搜索',
    path: '/search',
    match: (p) => p.startsWith('/search'),
    component: () => import('./apps/search/Search.vue'),
  },
  {
    id: 'files', icon: '📁', label: '文件',
    path: '/files',
    match: (p) => p.startsWith('/files'),
    component: () => import('./apps/files/Files.vue'),
  },
  {
    id: 'terminal', icon: '💻', label: '终端',
    path: '/terminal',
    match: (p) => p.startsWith('/terminal'),
    component: () => import('./apps/terminal/Terminal.vue'),
  },
  {
    id: 'settings', icon: '⚙️', label: '设置',
    path: '/assistant/settings',
    match: (p) => p.startsWith('/assistant/settings') || p.startsWith('/assistant/authorize'),
    component: () => import('./apps/assistant/AssistantSettings.vue'),
  },
]

export const launcherApps = apps  // 全部进宫格;以后想隐藏某个就 filter

export const findAppById   = (id)   => apps.find(a => a.id === id)
export const findAppByPath = (path) => apps.find(a => a.match(path))
