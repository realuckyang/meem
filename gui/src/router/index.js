import { createRouter, createWebHistory } from 'vue-router'
import { checkAuth, useAuth } from '@/composables/useAuth'
import { apps } from '@/apps.js'

const DEFAULT_PATH = '/assistant'  // 登录后默认进的应用

// 系统级路由
const systemRoutes = [
  { path: '/welcome', name: 'welcome', component: () => import('@/views/Welcome.vue'), meta: { guestOnly: true } },
  { path: '/', redirect: DEFAULT_PATH },
  // 老链接兼容
  { path: '/assistant/authorize', redirect: { name: 'settings', query: { tab: 'collab' } } },
  { path: '/ai',                  redirect: { name: 'settings', query: { tab: 'collab' } } },
]

// 应用路由:每个 app 一个主路由(name = app.id),外加 subRoutes
const appRoutes = apps.flatMap((app) => {
  if (app.id === 'settings') {
    return [{ path: app.path, name: 'settings', component: app.component, alias: ['/assistant-settings'] }]
  }
  const main = { path: app.path, name: app.id, component: app.component }
  // 兼容老 'home' 名字 → 等价于 notes
  const aliases = app.id === 'notes'
    ? [{ path: '/notes-home', name: 'home', component: app.component, redirect: app.path }]
    : []
  const sub = (app.subRoutes || []).map((r) => ({ ...r }))
  return [main, ...aliases, ...sub]
})

const routes = [
  ...systemRoutes,
  ...appRoutes,
  { path: '/:pathMatch(.*)*', redirect: DEFAULT_PATH },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  await checkAuth()
  const { isAuthenticated } = useAuth()
  if (to.meta.guestOnly && isAuthenticated.value) return DEFAULT_PATH
  if (!to.meta.guestOnly && !isAuthenticated.value) return { name: 'welcome' }
  return true
})

export default router
