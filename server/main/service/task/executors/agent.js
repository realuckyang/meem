import { chat } from '../../../ai/handler.js'

// 跑 agent 工具循环;事件用 emitMessage 持久化到任务消息表。
export const executeAgentTask = async ({ messages, settings, emitMessage, signal }) => {
  const { apiUrl, apiKey, model, provider, maxRounds } = settings
  const send = (msg) => {
    if (msg.type === 'tool_call') {
      if (msg.toolCall) {
        emitMessage({ role: 'assistant', content: null, tool_calls: [msg.toolCall] })
      }
      return
    }
    if (msg.type === 'tool_result' && msg.message) emitMessage(msg.message)
    // 'assistant_tool_calls' / 'done' 的 message 由 createTaskRun 的 finally 那段处理
  }
  const response = await chat(messages, {
    provider,
    apiUrl,
    apiKey,
    model,
    send,
    signal,
    maxRounds: maxRounds ?? 25,
    toolContext: {},
  })
  return {
    assistantMessage: { role: 'assistant', content: response },
    response,
  }
}
