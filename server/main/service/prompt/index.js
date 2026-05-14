// System prompt 组装器。
// 组合用户编辑的 instruction(settings.ai_system_prompt)+ 几段动态信息(环境 / 模型 / 记忆),
// 让助理每轮对话都能拿到最新的上下文。
//
// 故意没搬 AIOS 的 apps / chats / remarks / system-docs 几段:
//   - apps   meem 应用少且固定,价值有限
//   - chats  meem 单会话,没有跨会话索引
//   - remarks 同上
//   - system-docs meem 没有 /system/*.md 烘焙文档
// 后期需要再加。

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
