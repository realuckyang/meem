// 用 Node 22.5+ 内置的 node:sqlite,零原生依赖。
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = resolve(__dirname, '..', '..', '..', 'database', 'meem.db')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
