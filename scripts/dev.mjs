// 三进程开发:main(9602) + apps(9603) + vite(5173)
// vite 已经在 package.json 里配置 proxy 把 /api/* 打到 9602
import { spawn } from 'node:child_process'

const procs = [
  ['main', 'node', ['server/main/index.js', '--port=9602'], { MEEM_APPS_PORT: '9603' }],
  ['apps', 'node', ['server/apps/index.js', '--port=9603'], { MEEM_MAIN_PORT: '9602' }],
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
