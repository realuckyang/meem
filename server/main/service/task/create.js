import { getAllSettings } from '../../repository/settings.js'
import { createTaskRun } from './runner.js'
import { executeAgentTask } from './executors/agent.js'
import { executeInstantTask } from './executors/instant.js'

// 把 meem settings 转成 task 用的形状
const buildSettings = () => {
  const s = getAllSettings()
  const baseUrl = s.ai_base_url || ''
  return {
    apiUrl:   baseUrl,
    apiKey:   s.ai_api_key || '',
    model:    s.ai_model   || '',
    provider: '',  // 让 llm provider catalog 自动识别(从 apiUrl 匹配)
    maxRounds: 25,
  }
}

const normalizePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload_required')
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new Error('payload.messages_required')
  }
  const { apiKey, api_key, apiUrl, provider, signal, ...rest } = payload
  return rest
}

export const createAgentTask = async ({ app, title = '', payload, meta = null, wait = true }) => {
  const settings = buildSettings()
  if (!settings.apiUrl || !settings.apiKey || !settings.model) throw new Error('ai_not_configured')
  const taskPayload = { ...normalizePayload(payload), model: settings.model }
  return createTaskRun({
    mode: 'agent',
    app,
    title,
    payload: taskPayload,
    meta,
    wait,
    errorMessage: '任务执行失败',
    execute: ({ emitMessage, signal }) => executeAgentTask({
      messages: taskPayload.messages,
      settings,
      emitMessage,
      signal,
    }),
  })
}

export const createInstantTask = async ({ app, title = '', payload, meta = null }) => {
  const settings = buildSettings()
  if (!settings.apiUrl || !settings.apiKey || !settings.model) throw new Error('ai_not_configured')
  const taskPayload = { ...normalizePayload(payload), model: settings.model }
  return createTaskRun({
    mode: 'instant',
    app,
    title,
    payload: taskPayload,
    meta,
    errorMessage: 'Task execution failed',
    execute: ({ signal }) => executeInstantTask({ settings, signal, payload: taskPayload }),
  })
}
