// shell 工具:在本机执行任意 shell 命令(对齐 AIOS)。
import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'

const TIMEOUT_DEFAULT_MS = 30 * 1000
const TIMEOUT_MIN_MS     = 1 * 1000
const TIMEOUT_MAX_MS     = 5 * 60 * 1000
const SHELL_CANDIDATES = [
  process.env.SHELL,
  '/bin/sh',
  '/system/bin/sh',
]

const resolveTimeoutMs = (timeout) => {
  if (timeout == null) return TIMEOUT_DEFAULT_MS
  const seconds = Number(timeout)
  if (!Number.isFinite(seconds)) return TIMEOUT_DEFAULT_MS
  return Math.min(Math.max(seconds * 1000, TIMEOUT_MIN_MS), TIMEOUT_MAX_MS)
}

const resolveShell = () => {
  for (const sh of SHELL_CANDIDATES) {
    const v = String(sh || '').trim()
    if (v && existsSync(v)) return v
  }
  return undefined
}

export const shell = ({ command, cwd, timeout }) => new Promise((resolve) => {
  const options = {
    timeout: resolveTimeoutMs(timeout),
    maxBuffer: 1024 * 1024,
  }
  const shellPath = resolveShell()
  if (shellPath) options.shell = shellPath
  if (String(cwd || '').trim()) options.cwd = String(cwd).trim()

  exec(String(command || ''), options, (err, stdout, stderr) => {
    if (err) {
      resolve(`exit code ${err.code}\n${stderr || err.message}`)
      return
    }
    resolve(stdout || stderr || '(no output)')
  })
})
