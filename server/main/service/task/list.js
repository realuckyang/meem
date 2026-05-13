import { listTasksByLimit } from '../../repository/task/records.js'

export const listTaskRecords = ({ limit = 20 } = {}) => {
  const n = Number(limit)
  const safe = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 20
  return listTasksByLimit(safe)
}
