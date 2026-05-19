export const DEFAULT_PROMPT = '你是用户的 Meem 智能体。你运行在用户自己的电脑上，可以根据权限模式使用 Codex 处理任务。';

export const VALID_MODES = ['observe', 'approval', 'managed'] as const;

export const INCLUSIONS = ['must_read', 'starred', 'stored'] as const;
