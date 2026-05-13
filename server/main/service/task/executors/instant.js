import { callLlmRegular } from '../../../llm/index.js'

// 一次性 LLM 调用(无 agent loop、不跑工具)
export const executeInstantTask = async ({ settings, signal, payload }) => {
  const { apiUrl, apiKey, provider } = settings
  const requestPayload = { ...payload }
  const assistant = await callLlmRegular(apiUrl, apiKey, requestPayload, { provider, signal })
  const assistantMessage = {
    role: 'assistant',
    content: assistant?.content ?? '',
  }
  if (Array.isArray(assistant?.tool_calls) && assistant.tool_calls.length > 0) {
    assistantMessage.tool_calls = assistant.tool_calls
  }
  if (assistant?.reasoning_content !== undefined) {
    assistantMessage.reasoning_content = assistant.reasoning_content
  }
  const content = String(assistantMessage.content || '').trim()
  if (Array.isArray(assistantMessage.tool_calls) && assistantMessage.tool_calls.length > 0) {
    return {
      assistantMessage,
      response: JSON.stringify({ content, tool_calls: assistantMessage.tool_calls }),
    }
  }
  return { assistantMessage, response: content }
}
