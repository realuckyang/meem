// System prompt 组装器。
// 组合用户编辑的 instruction(settings.ai_system_prompt)+ 几段动态信息(环境 / 模型 / 记忆),
// 让助理每轮对话都能拿到最新的上下文。

import { getAllSettings } from '../../repository/settings.js'
import { instruction } from './instruction.js'
import { environment } from './environment.js'
import { model } from './model.js'
import { memory } from './memory.js'

export const buildSystemPrompt = () => {
  const settings = getAllSettings()
  let prompt = instruction()
  prompt += environment(process.cwd())
  prompt += model({ apiUrl: settings.ai_base_url, name: settings.ai_model })
  prompt += memory()
  return prompt
}
