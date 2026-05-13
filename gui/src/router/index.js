import { createRouter, createWebHistory } from 'vue-router'
import { checkAuth, useAuth } from '@/composables/useAuth'
import { apps } from '@/apps.js'

// 系统级路由(不在应用宫格里)
const systemRoutes = [
  { path: '/welcome', name: 'welcome', component: () => import('@/views/Welcome.vue'), meta: { guestOnly: true } },
  // 老链接兼容
  { path: '/assistant/authorize', redirect: { name: 'settings', query: { tab: 'collab' } } },
  { path: '/ai',                  redirect: { name: 'settings', query: { tab: 'collab' } } },
]

// 应用路由:每个 app 一个主路由(name = app.id),外加 subRoutes
const appRoutes = apps.flatMap((app) => {
  const main = { path: app.path, name: app.id, component: app.component }
  // 笔记的 home 用 id='notes' 但 path='/' → 提供个 alias 名 'home' 兼容
  const aliases = app.id === 'notes' ? [{ path: '/', name: 'home', component: app.component }] : []
  const sub = (app.subRoutes || []).map((r) => ({ ...r }))
  // 设置内部 tab 用 query,不需要专门子路由;但留个 name 兼容
  if (app.id === 'settings') {
    return [{ path: app.path, name: 'settings', component: app.component, alias: ['/assistant-settings'] }]
  }
  return [main, ...aliases, ...sub]
})

const routes = [
  ...systemRoutes,
  ...appRoutes,
  { path: '/:pathMatch(.*)*', redirect: '/' },
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
  if (to.meta.guestOnly && isAuthenticated.value) return { name: 'home' }
  if (!to.meta.guestOnly && !isAuthenticated.value) return { name: 'welcome' }
  return true
})

export default router
