// 生产:只起 main(9507) + apps(9508),main 直接 serve gui/dist
import { spawn } from 'node:child_process'

const procs = [
  ['main', 'node', ['server/main/index.js', '--port=9507'], { MEEM_APPS_PORT: '9508', MEEM_SERVE_GUI: '1' }],
  ['apps', 'node', ['server/apps/index.js', '--port=9508'], { MEEM_MAIN_PORT: '9507' }],
]

const children = []
for (const [name, cmd, args, env] of procs) {
  const p = spawn(cmd, args, {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, ...env },
  })
  p.on('exit', (code) => {
    console.error(`[${name}] exited ${code}`)
    for (const c of children) if (c.proc !== p) c.proc.kill()
    process.exit(code ?? 1)
  })
  children.push({ name, proc: p })
}
process.on('SIGINT',  () => children.forEach(c => c.proc.kill()))
process.on('SIGTERM', () => children.forEach(c => c.proc.kill()))
