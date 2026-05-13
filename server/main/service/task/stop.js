import { broadcast } from '../runtime/ws.js'
import { getTaskStatusById, updateTaskAborted } from '../../repository/task/records.js'
import { stopTaskExecution } from './execution.js'

export const stopTask = ({ id }) => {
  const task = getTaskStatusById(id)
  if (!task) return { status: 404, message: 'task_not_found' }
  if (task.status !== 'pending') return { status: 400, message: 'task_not_running' }
  const stopped = stopTaskExecution(id)
  updateTaskAborted({ taskId: id })
  broadcast({ type: 'tasks_changed' })
  return { success: true, stopped }
}
