import { randomUUID } from 'node:crypto'
import { broadcast } from '../runtime/ws.js'
import {
  insertTaskRecord,
  updateTaskAborted,
  updateTaskDone,
  updateTaskError,
} from '../../repository/task/records.js'
import { saveTaskMessage } from '../../repository/task/messages.js'
import { registerTaskExecution, unregisterTaskExecution } from './execution.js'

// 通用任务执行壳:建记录、注册中断器、跑 execute、根据结果落库 + 广播
export const createTaskRun = async ({
  mode,
  app,
  title = '',
  payload,
  meta = null,
  wait = true,
  execute,
  errorMessage = 'Task execution failed',
}) => {
  const conversationId = `task:${randomUUID().slice(0, 8)}`
  const { taskId } = insertTaskRecord({ conversationId, app, title, mode, payload, meta })
  broadcast({ type: 'tasks_changed' })

  const abortController = new AbortController()
  registerTaskExecution(taskId, abortController)

  const emitMessage = (message, metaValue = null) => {
    if (!message) return
    saveTaskMessage(conversationId, message, metaValue)
    // 任务详情页订阅这个事件做实时增量,不用轮询
    broadcast({ type: 'task_message_added', taskId, conversationId })
  }

  const exec = async () => {
    try {
      if (Array.isArray(payload?.messages)) {
        for (const m of payload.messages) emitMessage(m, { phase: 'request' })
      }
      const result = await execute({
        conversationId,
        emitMessage,
        signal: abortController.signal,
      })
      if (result?.assistantMessage) emitMessage(result.assistantMessage, null)
      const response = result?.response ?? ''
      updateTaskDone({ taskId, response })
      broadcast({ type: 'tasks_changed', taskId })
      return response
    } catch (error) {
      if (error?.name === 'AbortError') updateTaskAborted({ taskId })
      else updateTaskError({ taskId, message: error?.message || errorMessage })
      broadcast({ type: 'tasks_changed', taskId })
      if (wait) throw error
      return null
    } finally {
      unregisterTaskExecution(taskId)
    }
  }

  if (!wait) {
    exec().catch(() => {})
    return { id: taskId, conversationId, response: null }
  }

  const response = await exec()
  return { id: taskId, conversationId, response }
}
