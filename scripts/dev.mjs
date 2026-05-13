// 三进程开发:main(9507) + apps(9508) + vite(5173)
// vite 已经在 package.json 里配置 proxy 把 /api/* 打到 9507
import { spawn } from 'node:child_process'

// 屏蔽 node:sqlite 的 ExperimentalWarning(功能稳定,只是 Node 还没标 stable)
const NF = ['--disable-warning=ExperimentalWarning']
const procs = [
  ['main', 'node', [...NF, 'server/main/index.js', '--port=9507'], { MEEM_APPS_PORT: '9508' }],
  ['apps', 'node', [...NF, 'server/apps/index.js', '--port=9508'], { MEEM_MAIN_PORT: '9507' }],
  ['gui',  'npx',  ['vite', '--config', 'gui/vite.config.js', 'gui'], {}],
]

const children = []
for (const [name, cmd, args, env] of procs) {
  const p = spawn(cmd, args, {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, ...env },
  })
  p.on('exit', (code) => {
    console.error(`[${name}] exited code ${code}`)
    for (const c of children) if (c.proc !== p) c.proc.kill()
    process.exit(code ?? 1)
  })
  children.push({ name, proc: p })
}

const cleanup = () => { for (const c of children) c.proc.kill() }
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
