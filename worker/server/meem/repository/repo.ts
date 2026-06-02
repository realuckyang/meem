// 数据访问层 · 按域拆模块,makeRepo 组合成统一的 Repo。
import type { Env } from '../../types';
import type { Repo } from './types';
import { makeChats } from './chats';
import { makeMessages } from './messages';
import { makeDecisions } from './decisions';
import { makeContent } from './content';
import { makeRateLimit } from './ratelimit';
import { makeDocs } from './docs';
import { makeStorage } from './storage';
import { makeInbox } from './inbox';
import { makeTerminal } from './terminal';
import { makeTasks } from './tasks';
import { makeNotes } from './notes';
import { makeCodex } from './codex';
import { makeDevices } from './devices';
import { makeSettings } from './settings';

export * from './types';

export function makeRepo(env: Env, uid: string): Repo {
  return {
    ...makeChats(env, uid),
    ...makeMessages(env, uid),
    ...makeDecisions(env, uid),
    ...makeContent(env, uid),
    ...makeRateLimit(env),
    ...makeDocs(env, uid),
    ...makeStorage(env, uid),
    ...makeInbox(env, uid),
    ...makeTerminal(env, uid),
    ...makeTasks(env, uid),
    ...makeNotes(env, uid),
    ...makeCodex(env, uid),
    ...makeDevices(env, uid),
    ...makeSettings(env, uid),
  };
}
