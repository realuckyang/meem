#!/usr/bin/env node
// node-pty 1.x prebuilt tar 解压后偶尔会丢 spawn-helper 的可执行位,
// 导致 pty.spawn 报 "posix_spawnp failed"。这里给所有 prebuild 补 +x。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const base = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds')
if (!fs.existsSync(base)) process.exit(0)

for (const sub of fs.readdirSync(base)) {
  const helper = path.join(base, sub, 'spawn-helper')
  if (fs.existsSync(helper)) {
    try { fs.chmodSync(helper, 0o755) }
    catch (e) { console.warn(`chmod ${helper} 失败: ${e.message}`) }
  }
}
