<template>
  <div class="min-h-screen">
    <main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-20 md:px-12 md:pt-10">
      <h1 class="text-3xl md:text-[40px] font-bold leading-tight tracking-tight text-nt">设置</h1>

      <div class="mt-6 overflow-x-auto no-scrollbar">
        <div class="flex gap-1 border-b border-nt-divider min-w-max">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            :class="[
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition',
              tab === t.id
                ? 'border-nt font-medium text-nt'
                : 'border-transparent text-nt-soft hover:text-nt',
            ]"
            @click="setTab(t.id)"
          >{{ t.label }}</button>
        </div>
      </div>

      <!-- 账户 -->
      <section v-if="tab === 'account'" class="mt-6 space-y-5">
        <Field label="当前密码">
          <input
            v-model="pwdForm.old"
            type="password"
            autocomplete="current-password"
            class="mb-input"
          />
        </Field>
        <Field label="新密码" hint="至少 6 位">
          <input
            v-model="pwdForm.next"
            type="password"
            autocomplete="new-password"
            class="mb-input"
          />
        </Field>
        <Field label="重复新密码">
          <input
            v-model="pwdForm.next2"
            type="password"
            autocomplete="new-password"
            class="mb-input"
          />
        </Field>
        <SaveBar
          :busy="pwdBusy"
          :saved="pwdSaved"
          :error="pwdError"
          @save="onChangePassword"
        />
      </section>

      <!-- 模型 -->
      <section v-else-if="tab === 'model'" class="mt-6 space-y-5">
        <div v-if="loading" class="py-6 text-sm text-nt-soft">加载中…</div>
        <template v-else>
          <Field label="Base URL">
            <input
              v-model="form.ai_base_url"
              type="url"
              placeholder="https://api.openai.com/v1/chat/completions"
              class="mb-input"
            />
          </Field>

          <Field label="API Key">
            <input
              v-model="form.ai_api_key"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="sk-..."
              class="mb-input font-mono"
            />
          </Field>

          <Field label="Model">
            <input
              v-model="form.ai_model"
              type="text"
              placeholder="gpt-4o-mini"
              class="mb-input"
            />
          </Field>

          <SaveBar :busy="modelBusy" :saved="modelSaved" :error="modelError" @save="onSaveModel" />
        </template>
      </section>

      <!-- 上下文 -->
      <!-- 提示词 -->
      <section v-else-if="tab === 'prompt'" class="mt-6 space-y-5">
        <div v-if="loading" class="py-6 text-sm text-nt-soft">加载中…</div>
        <template v-else>
          <Field label="System Prompt">
            <textarea
              v-model="form.ai_system_prompt"
              rows="16"
              class="mb-input font-mono text-[13px] leading-relaxed"
            ></textarea>
          </Field>
          <SaveBar :busy="promptBusy" :saved="promptSaved" :error="promptError" @save="onSavePrompt" />
        </template>
      </section>

      <section v-else-if="tab === 'context'" class="mt-6 space-y-5">
        <div v-if="loading" class="py-6 text-sm text-nt-soft">加载中…</div>
        <template v-else>
          <Field label="历史轮数" hint="每次调用送给模型的最近 user 回合数">
            <div class="inline-flex overflow-hidden rounded-md border border-nt-divider">
              <button
                v-for="opt in roundOptions"
                :key="opt"
                type="button"
                :class="[
                  'px-4 py-1.5 text-sm transition',
                  Number(form.ai_context_rounds) === opt
                    ? 'bg-nt text-white'
                    : 'text-nt-muted hover:bg-nt-hover',
                ]"
                @click="form.ai_context_rounds = opt"
              >{{ opt }}</button>
            </div>
          </Field>

          <SaveBar :busy="contextBusy" :saved="contextSaved" :error="contextError" @save="onSaveContext" />
        </template>
      </section>

      <!-- 协作 -->
      <section v-else-if="tab === 'collab'" class="mt-6 space-y-3">
        <p class="text-sm text-nt-muted">
          把下面这段直接发给 Codex / Claude / 别的 AI,让它先理解 meem 的目录与约定,再开始改代码。
        </p>

        <section class="rounded-md border border-nt-divider">
          <div class="flex items-center justify-between border-b border-nt-divider px-3 py-2">
            <h2 class="text-sm font-medium text-nt">📝 上下文提示词</h2>
            <button
              type="button"
              class="rounded bg-nt px-3 py-1 text-xs text-white hover:bg-black"
              @click="copy(collabPrompt)"
            >{{ copied ? '✓ 已复制' : '复制' }}</button>
          </div>
          <pre class="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words bg-nt-hover/30 p-3 font-mono text-[12px] leading-relaxed text-nt">{{ collabPrompt }}</pre>
        </section>
      </section>

      <!-- 技能 -->
      <section v-else-if="tab === 'skills'" class="mt-6">
        <section class="rounded-md border border-nt-divider p-4">
          <h2 class="text-sm font-medium text-nt">📦 MindBase 技能包</h2>
          <p class="mt-1 text-xs text-nt-muted">Claude Code 装到 <code class="rounded bg-nt-hover px-1 py-0.5 font-mono">~/.claude/skills/</code>。</p>
          <a
            href="/skills/mindbase.zip"
            download="mindbase-skill.zip"
            class="mt-3 inline-flex items-center gap-2 rounded-md bg-nt px-4 py-2 text-sm text-white hover:bg-black"
          >⬇ 下载 mindbase-skill.zip</a>
        </section>
      </section>

      <!-- 关于 -->
      <section v-else-if="tab === 'about'" class="mt-6 space-y-4">
        <div class="flex items-center gap-3">
          <img src="/favicon.svg" alt="" class="h-12 w-12" />
          <div>
            <h2 class="text-lg font-semibold text-nt">MindBase</h2>
            <p class="text-xs text-nt-soft">个人知识库 · 想法 · 笔记 · 助理</p>
          </div>
        </div>

        <p class="text-sm leading-relaxed text-nt-muted">
          MindBase 是一个开源的个人知识库工具,设计目标是单人单机自部署。
          基于 Cloudflare Workers + D1 + R2,部署成本接近零。
          数据完全握在自己手里,助理通过 shell 工具在本机执行任意命令(读写数据库 / 文件 / 网络等),不依赖任何第三方服务。
        </p>

        <div class="rounded-md border border-nt-divider p-4">
          <div class="text-xs text-nt-soft">项目地址</div>
          <a
            href="https://github.com/valueriver/mindbase"
            target="_blank"
            rel="noopener"
            class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-nt-accent hover:underline break-all"
          >
            github.com/valueriver/mindbase
            <span class="text-xs">↗</span>
          </a>
        </div>

        <p class="text-xs text-nt-soft">
          MIT License · 欢迎 issue / PR / star
        </p>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiSettings, apiUser } from '@/api/client'

const Field = (props, { slots }) => h('label', { class: 'block' }, [
  h('div', { class: 'mb-1 text-sm font-medium text-nt' }, props.label),
  props.hint ? h('div', { class: 'mb-1 text-xs text-nt-soft' }, props.hint) : null,
  slots.default?.(),
])
Field.props = ['label', 'hint']

const SaveBar = (props, { emit }) => h('div', { class: 'flex items-center gap-3 pt-2' }, [
  h('button', {
    type: 'button',
    disabled: props.busy,
    class: 'rounded-md bg-nt px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-50',
    onClick: () => emit('save'),
  }, props.busy ? '保存中…' : '保存'),
  props.saved ? h('span', { class: 'text-xs text-nt-soft' }, '✓ 已保存') : null,
  props.error ? h('span', { class: 'text-xs text-nt-danger' }, props.error) : null,
])
SaveBar.props = ['busy', 'saved', 'error']
SaveBar.emits = ['save']

const route  = useRoute()
const router = useRouter()
const tabs = [
  { id: 'account', label: '账户' },
  { id: 'model',   label: '模型' },
  { id: 'prompt',  label: '提示词' },
  { id: 'context', label: '上下文' },
  { id: 'collab',  label: '协作' },
  { id: 'skills',  label: '技能' },
  { id: 'about',   label: '关于' },
]
const VALID = new Set(tabs.map(t => t.id))
const tab = ref(VALID.has(route.query.tab) ? route.query.tab : 'account')
function setTab(t) {
  tab.value = t
  router.replace({ query: { ...route.query, tab: t } })
}

// === 模型 / 上下文 共用同一份 form,因为都来自 settings ===
const roundOptions = [30, 100, 500]
const loading = ref(true)
const form = reactive({
  ai_base_url: '',
  ai_api_key:  '',
  ai_model:    '',
  ai_context_rounds: 100,
  ai_system_prompt: '',
})

async function loadSettings() {
  loading.value = true
  try {
    const { settings } = await apiSettings.detail()
    form.ai_base_url = settings.ai_base_url
    form.ai_api_key  = settings.ai_api_key
    form.ai_model    = settings.ai_model
    form.ai_context_rounds = settings.ai_context_rounds || 100
    form.ai_system_prompt  = settings.ai_system_prompt || ''
  } catch {} finally {
    loading.value = false
  }
}

const modelBusy = ref(false), modelSaved = ref(false), modelError = ref('')
async function onSaveModel() {
  modelBusy.value = true; modelSaved.value = false; modelError.value = ''
  try {
    const { settings } = await apiSettings.update({
      ai_base_url: form.ai_base_url.trim(),
      ai_api_key:  form.ai_api_key.trim(),
      ai_model:    form.ai_model.trim(),
    })
    form.ai_base_url = settings.ai_base_url
    form.ai_api_key  = settings.ai_api_key
    form.ai_model    = settings.ai_model
    modelSaved.value = true
    setTimeout(() => { modelSaved.value = false }, 1500)
  } catch (e) {
    modelError.value = e?.message || '保存失败'
  } finally { modelBusy.value = false }
}

const promptBusy = ref(false), promptSaved = ref(false), promptError = ref('')
async function onSavePrompt() {
  promptBusy.value = true; promptSaved.value = false; promptError.value = ''
  try {
    const { settings } = await apiSettings.update({
      ai_system_prompt: form.ai_system_prompt,
    })
    form.ai_system_prompt = settings.ai_system_prompt
    promptSaved.value = true
    setTimeout(() => { promptSaved.value = false }, 1500)
  } catch (e) {
    promptError.value = e?.message || '保存失败'
  } finally { promptBusy.value = false }
}

const contextBusy = ref(false), contextSaved = ref(false), contextError = ref('')
async function onSaveContext() {
  contextBusy.value = true; contextSaved.value = false; contextError.value = ''
  try {
    const { settings } = await apiSettings.update({
      ai_context_rounds: form.ai_context_rounds,
    })
    form.ai_context_rounds = settings.ai_context_rounds
    contextSaved.value = true
    setTimeout(() => { contextSaved.value = false }, 1500)
  } catch (e) {
    contextError.value = e?.message || '保存失败'
  } finally { contextBusy.value = false }
}

// === 协作:给外部 AI 看的项目上下文 ===
const copied = ref(false)
const collabPrompt = `你将协作开发 meem ── 一个单机自部署的个人知识库。

# 一句话

本机跑的 Node.js + node:sqlite 应用,UI Notion 风,目前有 6 个应用:聊天 / 想法 / 待办 / 笔记 / 搜索 / 设置。所有用户数据在 database/meem.db 一个 SQLite 文件里,完全在本地,没有云。

# 运行

- 开发:\`npm run dev\` → 三进程:main 9507 + apps 9508 + vite 5173
- 生产:\`npm run start\` → 两进程,main 直接 serve gui/dist
- 数据库:database/meem.db(WAL 模式)
- 节点:Node >= 22.5(用 node:sqlite,无原生编译依赖)

# 架构(参照 AIOS 风格,内核与应用分进程)

\`\`\`
server/
├── shared/http/            通用 http 工具(json/readBody)
├── main/                   内核(9507),对外唯一入口
│   ├── api/                路由分发
│   │   ├── auth/           密码登录 / setup / 改密
│   │   ├── settings/       KV 配置
│   │   ├── chat/           SSE 助理(含 shell 工具)
│   │   ├── search/         跨应用全文搜索
│   │   └── tokens/         对外 API token(自用一般不用)
│   ├── service/auth/       PBKDF2 + JWT cookie
│   ├── repository/         系统表:settings / messages / tokens
│   ├── ai/                 agent 循环 + 工具
│   │   ├── handler.js      多轮循环
│   │   ├── runner.js       并行跑工具
│   │   ├── tools.js        工具 schema
│   │   ├── functions.js    工具实现(shell:对齐 AIOS)
│   │   └── system-prompt.js DEFAULT_SYSTEM_PROMPT
│   └── llm/                OpenAI 兼容 provider 适配 + 流式
└── apps/                   用户应用(9508,只接 9507 转发)
    ├── index.js            dispatcher
    ├── registry.js         应用注册
    ├── memos/              想法
    ├── todos/              待办
    └── notes/              笔记本 + 笔记

apps/<name>/APP.md          给 AI 看的应用元数据(表名、API)

gui/src/
├── apps.js                 应用注册表(单一事实源)
├── apps/<name>/            每个应用的 Vue 组件
├── components/             跨应用通用(AppShell/Popover/Cover/EmojiPicker)
├── views/Welcome.vue       系统页(创建账号/登录)
├── router/index.js         从 apps.js 自动生成路由
├── api/client.js           前端 API client
└── assets/main.css         Tailwind v4 + Notion 风主题色(--color-nt-*)
\`\`\`

# 关键约定

1. **后端应用模块** 默认 export \`{ name, match, initDb, handleApi }\`,挂到 \`server/apps/registry.js\` 即生效。
2. **应用表名前缀** \`apps_<name>\` (例:apps_memos / apps_todos / apps_notebooks / apps_notes)。系统表是 settings / messages / tokens,不带前缀。
3. **API 路径**:内核 \`/api/*\`,应用 \`/apps/<name>/*\`(GUI 都连 9507,内核把 /apps/* 鉴权后转发到 9508)。
4. **鉴权**:全局 cookie JWT;首次访问引导创建账号(\`/api/auth/status\` + \`/api/auth/setup\`)。
5. **前端 apps.js 一条记录 = 一个应用**:含 id / icon / label / path / match / component(懒加载)/ subRoutes。AppShell 用它生成宫格,router 用它生成路由。
6. **SSE 必须 setNoDelay**:server 内核已经做了,vite proxy 也做了,生产环境一条腿,不需要 vite 那段。

# 数据库表

系统(server/main):
- settings(key, value, updated_at) — KV(包括 auth_username / auth_password_hash / auth_password_salt / ai_base_url / ai_api_key / ai_model / ai_context_rounds / ai_system_prompt / home_* / memos_*)
- messages(id, conversation_id, message, memo, usage, meta, created_at) — 助理对话,conversation_id 当前硬编码 'main'
- tokens(id, name, token, scope, created_at, last_used_at) — 对外授权(本机用基本闲置)

应用(server/apps):
- apps_memos(id, content, created_at, updated_at)
- apps_todos(id, title, done, sort_order, created_at, updated_at)
- apps_notebooks(id, parent_id, name, icon, cover, sort_order, created_at, updated_at)
- apps_notes(id, notebook_id, title, content, icon, cover, sort_order, created_at, updated_at)

# 加一个应用要做什么

1. 后端:\`server/apps/<name>/{index.js, api/index.js, repository/init.js}\`,index.js 默认 export \`{ name, match, initDb, handleApi }\`。
2. 注册:\`server/apps/registry.js\` 加一行 \`() => import('./<name>/index.js')\`。
3. 文档:\`apps/<name>/APP.md\`(说明:表名、API、用途)。
4. 前端:\`gui/src/apps/<name>/<Main>.vue\`。
5. 注册:\`gui/src/apps.js\` 数组里加一条。
6. 完事。router 和应用宫格自动生效。

# 风格

- 前端 Tailwind v4(\`@theme\` 写在 src/assets/main.css),主题色用 \`--color-nt-*\`(Notion 风)。
- 中文 UI,简洁直接,不要过度文案。
- 助手消息走 markdown 渲染(marked + DOMPurify)。
- 写代码:复用现有组件,Pinia 不强求,大部分用 \`ref\` + composables 就够。

# 你要怎么改

- 顺着上面约定走,别引入新依赖除非真的必要。
- 改完直接说改了哪些文件 + 为什么,不要废话。
- 如果不确定某处怎么改,问我或先 grep 现有代码找类似的写法。
- 数据库改 schema 要给迁移脚本(放 migrations/ 目录,文件名带日期)。
`

// === 账户:改密码 ===
const pwdForm = reactive({ old: '', next: '', next2: '' })
const pwdBusy  = ref(false)
const pwdSaved = ref(false)
const pwdError = ref('')

async function onChangePassword() {
  pwdError.value = ''
  pwdSaved.value = false
  if (!pwdForm.old)            { pwdError.value = '请输入当前密码'; return }
  if (pwdForm.next.length < 6) { pwdError.value = '新密码至少 6 位'; return }
  if (pwdForm.next !== pwdForm.next2) { pwdError.value = '两次输入的新密码不一致'; return }

  pwdBusy.value = true
  try {
    await apiUser.changePassword(pwdForm.old, pwdForm.next)
    pwdForm.old = ''
    pwdForm.next = ''
    pwdForm.next2 = ''
    pwdSaved.value = true
    setTimeout(() => { pwdSaved.value = false }, 1500)
  } catch (e) {
    const msg = e?.message || ''
    if (/invalid_old_password/.test(msg)) pwdError.value = '当前密码错误'
    else if (/password_too_short/.test(msg)) pwdError.value = '新密码至少 6 位'
    else pwdError.value = msg || '修改失败'
  } finally {
    pwdBusy.value = false
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {}
}

onMounted(() => { loadSettings() })
</script>

<style scoped>
.mb-input {
  width: 100%;
  border-radius: 6px;
  border: 1px solid rgba(55, 53, 47, 0.16);
  padding: 8px 10px;
  font-size: 14px;
  color: var(--color-nt);
  background: white;
  outline: none;
}
.mb-input:focus { border-color: var(--color-nt-accent); }
.mb-input::placeholder { color: var(--color-nt-hint); }
</style>
