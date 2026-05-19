import fsp from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import WebSocket from 'ws';
import codex from './codexBridge.js';
import { codexConfigForMode } from './agentModes.js';
import { workspaceForSession, SERVER_DIR, SERVER_TOKEN_FILE, MEEM_WORKSPACES_DIR } from './paths.js';

const MEEM_BASE = process.env.MEEM_BASE_URL || 'https://meem.chatnext.ai';
const RECONNECT_MIN = 1000;
const RECONNECT_MAX = 30000;
const PROBE_INTERVAL = 30 * 1000;

// 设备信息（启动时定一次）
const DEVICE = (() => {
  const plat = os.platform();             // darwin / linux / win32
  const rel  = os.release();              // 23.x.x
  const arch = os.arch();                 // arm64 / x64
  const pretty = plat === 'darwin'
    ? `macOS ${rel} (${arch})`
    : `${plat} ${rel} (${arch})`;
  return { os: pretty, hostname: os.hostname() };
})();

// bridge 自己的版本号（从 package.json 读，失败回退 0.0.0）
const BRIDGE_VERSION = (() => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.join(here, '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version || '0.0.0';
  } catch { return '0.0.0'; }
})();
const BRIDGE_STARTED_AT = Date.now();

let token = '';
let socket = null;
let reconnectMs = RECONNECT_MIN;
let reconnectTimer = null;
let lastError = '';
let connectedAt = 0;

// Codex 本机探测结果（异步刷新）
let codexCaps = { codex: false, codexVersion: '', codexLoggedIn: false };
let probeTimer = null;

// 用户主动取消的 session：handleAgentTask 进展到任何节点都会检查
const cancelledSessions = new Set();

function run(cmd, args, timeoutMs = 3000) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs });
    return {
      ok: r.status === 0,
      stdout: (r.stdout || '').trim(),
      stderr: (r.stderr || '').trim(),
    };
  } catch (err) {
    return { ok: false, stdout: '', stderr: err?.message || String(err) };
  }
}

function probeCodex() {
  const ver = run('codex', ['--version']);
  if (!ver.ok) return { codex: false, codexVersion: '', codexLoggedIn: false };

  const versionStr = ver.stdout || ver.stderr;
  // 抽 "codex-cli 0.31.0" 或 "0.31.0"，能拿到第一个数字串就用
  const m = versionStr.match(/\d+\.\d+(?:\.\d+)?/);
  const version = m ? m[0] : versionStr;

  const login = run('codex', ['login', 'status']);
  const text = (login.stdout || login.stderr).toLowerCase();
  const loggedIn = login.ok
    && /logged in/.test(text)
    && !/not logged in/.test(text);

  return { codex: true, codexVersion: version, codexLoggedIn: loggedIn };
}

function refreshCodexCaps() {
  const next = probeCodex();
  const changed =
    next.codex !== codexCaps.codex ||
    next.codexVersion !== codexCaps.codexVersion ||
    next.codexLoggedIn !== codexCaps.codexLoggedIn;
  codexCaps = next;
  if (changed && socket?.readyState === WebSocket.OPEN) sendHello();
}

function startCodexProbeLoop() {
  if (probeTimer) return;
  refreshCodexCaps();
  probeTimer = setInterval(refreshCodexCaps, PROBE_INTERVAL);
}

function sendHello() {
  try {
    socket?.send(JSON.stringify({
      type: 'hello',
      capabilities: {
        ...codexCaps,
        bridgeVersion: BRIDGE_VERSION,
        bridgeStartedAt: BRIDGE_STARTED_AT,
        os: DEVICE.os,
        hostname: DEVICE.hostname,
      },
    }));
  } catch {}
}

async function loadStoredToken() {
  try {
    const payload = JSON.parse(await fsp.readFile(SERVER_TOKEN_FILE, 'utf8'));
    return String(payload?.token || '').trim();
  } catch {
    return '';
  }
}

async function persistToken(t) {
  try {
    await fsp.mkdir(SERVER_DIR, { recursive: true });
    await fsp.writeFile(SERVER_TOKEN_FILE, JSON.stringify({
      token: t,
      updated_at: new Date().toISOString(),
      base: MEEM_BASE,
    }, null, 2), 'utf8');
  } catch (err) { lastError = `persist token: ${err.message}`; }
}

function wsUrl() {
  const u = new URL(MEEM_BASE);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/ws';
  u.searchParams.set('token', token);
  u.searchParams.set('client', '1');
  return u.toString();
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const wait = reconnectMs;
  reconnectMs = Math.min(RECONNECT_MAX, reconnectMs * 2);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, wait);
}

function connect() {
  if (!token) return;
  try { socket?.close(); } catch {}

  const url = wsUrl();
  const ws = new WebSocket(url);
  socket = ws;

  ws.on('open', () => {
    reconnectMs = RECONNECT_MIN;
    connectedAt = Date.now();
    lastError = '';
    sendHello();
    console.log(`[meem] connected ${MEEM_BASE}`);
  });

  ws.on('message', async (data) => {
    let frame;
    try { frame = JSON.parse(data.toString()); }
    catch { return; }
    if (frame?.type === 'agent-task') {
      handleAgentTask(frame.task).catch(err => {
        console.error('[meem] agent task failed:', err?.message || err);
      });
    }
    if (frame?.type === 'agent-cancel' && frame.session_id) {
      cancelledSessions.add(String(frame.session_id));
      console.log(`[meem] session ${String(frame.session_id).slice(0, 8)} cancelled by user`);
    }
  });

  ws.on('close', () => {
    console.log('[meem] ws closed');
    connectedAt = 0;
    scheduleReconnect();
  });
  ws.on('error', (err) => {
    lastError = err?.message || String(err);
    console.warn('[meem] ws error:', lastError);
  });
}

async function handleAgentTask(task) {
  if (!task) return;
  const sessionId = String(task.session_id || '');
  const ownerId = String(task.owner_id || '');
  const kind = task.kind || 'direct_chat';
  const mode = task.mode || 'observe';
  if (!sessionId) {
    console.warn('[meem] agent-task missing session_id, ignoring');
    return;
  }
  // 事件聚合：把 codex 的低层流压成高层条目
  // 实时 → ws 广播（partial 快照）
  // 完成 → POST /api/sessions/:id/events 一行行落库
  const itemBuffer = new Map(); // itemId -> { kind, text, type }

  const isCancelled = () => cancelledSessions.has(sessionId);

  const sendLiveFrame = (ev) => {
    if (isCancelled()) return;
    // 直播只用 WS 推，不落库（partial 太多没必要存）
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({
          type: 'agent-event-live',
          session_id: sessionId,
          event: ev,
        }));
      } catch {}
    }
  };

  const pendingPersist = [];
  let sawAgentMessage = false;
  let flushTimer = null;
  const schedulePersist = () => {
    if (flushTimer || !pendingPersist.length) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      const batch = pendingPersist.splice(0);
      try {
        await api('POST', `/api/sessions/${encodeURIComponent(sessionId)}/events`, {
          events: batch,
        });
      } catch (err) {
        console.error('[meem] persist events failed:', err?.message || err);
      }
    }, 200);
  };
  const persistEvent = (kind, payload, in_reply_to) => {
    if (isCancelled()) return;
    if (kind === 'agent_message') sawAgentMessage = true;
    pendingPersist.push({ kind, payload, in_reply_to: in_reply_to || null });
    schedulePersist();
  };
  // mapKind 已经把 codex 的 item type 归化到 agent_message / reasoning / command_exec 等；
  // 数据库里我们用 agent_ 前缀的版本；只在没前缀时补
  const toEventKind = (k) => k.startsWith('agent_') ? k : 'agent_' + k;

  const mapKind = (t) => {
    if (!t) return 'raw';
    const s = String(t).toLowerCase();
    if (s.startsWith('user') || /user_message/.test(s)) return 'user_message';
    if (/reason/.test(s)) return 'reasoning';
    if (/command|shell|exec/.test(s)) return 'command_exec';
    if (/tool/.test(s)) return 'tool_call';
    if (/file/.test(s)) return 'file_change';
    if (/message/.test(s)) return 'agent_message';
    return s;
  };

  // 这些类型对用户无信息量，过滤掉
  const SKIP_KINDS = new Set(['user_message']);

  // kind 命名约定（跟 worker events 对齐）：
  //   agent_reasoning / agent_message / agent_shell / agent_file_change
  //   agent_tool_call / agent_plan
  //   agent_approval_request / agent_input_request
  const captureEvent = (msg) => {
    if (!msg || typeof msg !== 'object') return;
    const m = msg.method || '';
    const p = msg.params || {};

    if (m === 'turn/started') {
      sendLiveFrame({ live: 'turn-start' });
      return;
    }
    if (m === 'turn/completed') {
      // 收尾还没 complete 的 item
      for (const [id, buf] of itemBuffer.entries()) {
        if (!buf.text) continue;
        sendLiveFrame({ live: 'item-done', id, kind: buf.kind, text: buf.text });
        persistEvent(toEventKind(buf.kind), { text: buf.text });
      }
      itemBuffer.clear();
      sendLiveFrame({ live: 'turn-end' });
      return;
    }
    if (m === 'item/started') {
      const it = p?.item;
      if (!it?.id) return;
      const rawKind = mapKind(it.type || it.kind);
      if (SKIP_KINDS.has(rawKind)) return;
      const text = pickItemText(it);
      itemBuffer.set(it.id, { kind: rawKind, text, type: it.type });
      sendLiveFrame({ live: 'item-partial', id: it.id, kind: rawKind, text });
      return;
    }
    if (m === 'item/agentMessage/delta' || m === 'item/agentReasoning/delta') {
      const id = p?.itemId;
      if (!id) return;
      const k = m.includes('Reasoning') ? 'reasoning' : 'agent_message';
      const buf = itemBuffer.get(id) || { kind: k, text: '', type: k };
      buf.text += p?.delta || '';
      itemBuffer.set(id, buf);
      sendLiveFrame({ live: 'item-partial', id, kind: buf.kind, text: buf.text });
      return;
    }
    if (m === 'item/completed') {
      const it = p?.item;
      if (!it?.id) return;
      const buf = itemBuffer.get(it.id);
      const rawKind = buf?.kind || mapKind(it.type || it.kind);
      if (SKIP_KINDS.has(rawKind)) { itemBuffer.delete(it.id); return; }
      const text = pickItemText(it) || buf?.text || '';
      const meta = pickItemMeta(it);
      sendLiveFrame({ live: 'item-done', id: it.id, kind: rawKind, text, meta });
      // reasoning items 通常无文本（codex 不暴露），跳过；
      // 其他事件没文本也没有效 meta 也跳过
      const hasMetaContent = meta && Object.keys(meta).some(k => k !== 'type');
      if (rawKind === 'reasoning' && !text) {
        // skip
      } else if (text || hasMetaContent) {
        persistEvent(toEventKind(rawKind), { text, ...(meta ? { meta } : {}) });
      }
      itemBuffer.delete(it.id);
      return;
    }
    if (m === 'turn/plan/updated') {
      const planMeta = p?.plan ?? p;
      sendLiveFrame({ live: 'plan', meta: planMeta });
      persistEvent('agent_plan', { plan: planMeta });
      return;
    }
    // 其他 noise（thread/status, tokenUsage, rateLimits, mcp startup）丢弃
  };

  function pickItemText(item) {
    if (!item) return '';
    if (typeof item.text === 'string') return item.text;
    if (typeof item.message === 'string') return item.message;
    if (typeof item.content === 'string') return item.content;
    // OpenAI 风格：content = [{ type: 'text', text: '...' }, ...]
    if (Array.isArray(item.content)) {
      return item.content
        .map(c => typeof c === 'string' ? c : (c?.text ?? c?.content ?? ''))
        .filter(Boolean)
        .join('\n');
    }
    if (typeof item.command === 'string') return item.command;
    if (Array.isArray(item.command)) return item.command.join(' ');
    if (Array.isArray(item.commandLine)) return item.commandLine.join(' ');
    return '';
  }
  function pickItemMeta(item) {
    if (!item) return undefined;
    const meta = {};
    if (item.type) meta.type = item.type;
    if (item.exitCode !== undefined) meta.exit_code = item.exitCode;
    if (item.exit_code !== undefined) meta.exit_code = item.exit_code;
    if (item.stdout) meta.stdout = String(item.stdout).slice(0, 2000);
    if (item.stderr) meta.stderr = String(item.stderr).slice(0, 2000);
    if (item.command) meta.command = item.command;
    if (item.path) meta.path = item.path;
    if (item.name) meta.name = item.name;
    if (item.arguments) meta.arguments = item.arguments;
    return Object.keys(meta).length ? meta : undefined;
  }

  let reply;
  let finalStatus = 'done';
  try {
    // 每个 session 独占工作区，避免并行任务串线
    const scopeKey = kind === 'direct_chat'
      ? `direct-${safeWorkspaceKey(sessionId)}`
      : (kind === 'message_agent'
        ? `message-${safeWorkspaceKey(task.conversation_id || sessionId)}`
        : `session-${safeWorkspaceKey(sessionId)}`);
    const workspacePath = workspaceForSession(`${ownerId}-${scopeKey}`);
    const codexCwd = await resolveCodexCwd(task.cwd, workspacePath);
    await fsp.mkdir(workspacePath, { recursive: true });
    const context = await writeAgentsMd(workspacePath, task, { codexCwd });

    reply = await runAgentTurn({
      workspacePath,
      codexCwd,
      mode,
      task,
      memorySignature: context.signature,
      contextText: context.text,
      injectContext: codexCwd !== workspacePath,
      onEvent: captureEvent,
    });
  } catch (err) {
    console.error('[meem] agent run failed:', err?.message || err);
    finalStatus = 'errored';
    persistEvent('agent_error', { message: err?.message || String(err) });
  }

  // 取消可能在排队的定时 flush，自己强制 flush 一次
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

  // 用户在跑的过程中点了"停止"——worker 已经把状态置成 cancelled，
  // bridge 这里就闭嘴：不再补 agent_message，不再 flush 尾巴，不要覆盖状态
  const wasCancelled = cancelledSessions.has(sessionId);
  cancelledSessions.delete(sessionId); // 跑完一律清理，避免 Set 长留
  if (wasCancelled) {
    console.log(`[meem] session ${sessionId.slice(0, 8)} → cancelled (user)`);
    return;
  }

  if (reply?.source && reply.source !== 'codex') {
    pendingPersist.push({
      kind: 'agent_reasoning',
      payload: {
        text: reply.source === 'stub-no-codex'
          ? '本机 Codex 未就绪，已生成草稿。'
          : 'Codex 未返回可用结果，已生成草稿。',
        source: reply.source,
      },
      in_reply_to: null,
    });
  }

  // 如果 Codex 一个 agent_message 都没推（例如降级草稿），把 reply.text 补一条。
  if (!sawAgentMessage && reply?.text) {
    pendingPersist.push({
      kind: 'agent_message',
      payload: { text: reply.text, source: reply.source },
      in_reply_to: null,
    });
  }
  if (pendingPersist.length) {
    const batch = pendingPersist.splice(0);
    try {
      await api('POST', `/api/sessions/${encodeURIComponent(sessionId)}/events`, {
        events: batch,
      });
    } catch (err) {
      console.error('[meem] persist tail events failed:', err?.message || err);
    }
  }

  console.log(`[meem] session ${sessionId.slice(0, 8)} → ${finalStatus}` +
    (reply ? ` (${reply.source})` : ''));

  await api('PATCH', `/api/sessions/${encodeURIComponent(sessionId)}`, {
    status: finalStatus,
  }).catch(err => console.error('[meem] update session status failed:', err?.message || err));

  // message_agent 的输出始终是内部草稿或讨论结果。
  // 外部发送只能由用户在消息里明确采用并发送，避免后续内部追问误发给联系人。
}

async function runAgentTurn({ workspacePath, codexCwd, mode, task, memorySignature, contextText, injectContext, onEvent }) {
  const cfg = codexConfigForMode(mode);
  const turns = Array.isArray(task.turns) ? task.turns : [];
  const lastUser = turns.slice().reverse().find(t => t.role === 'user');
  const currentText = lastUser ? formatTurnForPrompt(lastUser, task) : (task.trigger?.content || '');
  if (!currentText) return null;

  // 历史 = turns 除最后一条以外的所有；fresh thread 时拼进 prefix 让 Codex 看到上下文
  const pastTurns = turns.slice(0, Math.max(0, turns.length - 1));
  function buildPromptWithHistory() {
    if (!pastTurns.length) return currentText;
    const prefix = pastTurns
      .map(t => formatTurnForPrompt(t, task, { history: true }))
      .join('\n\n');
    return `[历史对话上下文，仅供参考，不要重复回答]\n${prefix}\n\n[当前问题]\n${currentText}`;
  }

  if (!codexCaps.codex) {
    return {
      text: `（草稿 · 未安装 Codex）${currentText.length > 40 ? currentText.slice(0, 40) + '…' : currentText}\n→ 这是一个占位回复，等本机装好 codex CLI 后会换成真正生成的内容。`,
      source: 'stub-no-codex',
    };
  }

  // 优先用 codex，失败 fallback
  const statePath = path.join(workspacePath, 'meem-thread.json');
  const withContext = (prompt) => {
    if (!injectContext) return prompt;
    return `[Meem 会话上下文]\n${contextText}\n\n[用户当前输入]\n${prompt}`;
  };

  async function tryRun(threadId, prompt) {
    return codex.runTurn({
      prompt: withContext(prompt),
      threadId: threadId || '',
      cwd: codexCwd,
      approvalPolicy: cfg.approvalPolicy,
      sandbox: cfg.sandbox,
    }, onEvent);
  }

  async function freshThread() {
    const t = await codex.createThread({
      cwd: codexCwd,
      approvalPolicy: cfg.approvalPolicy,
      sandbox: cfg.sandbox,
    });
    await fsp.writeFile(statePath, JSON.stringify({
      threadId: t?.id || '',
      triggerMessageId: task.trigger_message_id,
      mode,
      sandbox: cfg.sandbox,
      approvalPolicy: cfg.approvalPolicy,
      memorySignature,
      codexCwd,
      createdAt: Date.now(),
    }, null, 2));
    return t;
  }

  try {
    await codex.start();

    let existing = null;
    try { existing = JSON.parse(await fsp.readFile(statePath, 'utf8')); } catch {}

    // 模式 / sandbox / approval 跟 thread 当初创建时不一致 → 强制重建
    // codex 的 thread 在创建时锁定 sandbox，事后 runTurn 升降权不生效
    if (existing?.threadId && (
      existing.mode !== mode ||
      existing.sandbox !== cfg.sandbox ||
      existing.approvalPolicy !== cfg.approvalPolicy ||
      existing.memorySignature !== memorySignature ||
      existing.codexCwd !== codexCwd
    )) {
      console.log(`[meem] thread context changed, rebuilding thread`);
      try { await fsp.unlink(statePath); } catch {}
      existing = null;
    }

    let threadIsFresh = false;
    let thread;
    if (existing?.threadId) {
      thread = { id: existing.threadId, cwd: codexCwd };
    } else {
      thread = await freshThread();
      threadIsFresh = true;
    }

    // fresh thread = Codex 没有任何历史；带上历史 prefix
    // 复用旧 thread = Codex 自己记得，直接用当前问题
    let prompt = threadIsFresh ? buildPromptWithHistory() : currentText;

    let result;
    try {
      result = await tryRun(thread.id, prompt);
    } catch (err) {
      // 旧 thread 可能因 bridge / app-server 重启失效——干掉重来一次
      console.warn('[meem] runTurn failed with cached thread, retrying fresh:', err?.message || err);
      try { await fsp.unlink(statePath); } catch {}
      thread = await freshThread();
      threadIsFresh = true;
      prompt = buildPromptWithHistory();
      result = await tryRun(thread.id, prompt);
    }

    const text = String(result?.finalText || '').trim();
    if (text) return { text, source: 'codex' };
  } catch (err) {
    console.warn('[meem] codex failed, falling back:', err?.message || err);
  }

  // Fallback：直接给一个清晰的占位草稿
  return {
    text: `（草稿 · 未接 Codex）针对「${prompt.slice(0, 60)}」的回复占位。请在桌面端配置 Codex。`,
    source: 'stub',
  };
}

function safeWorkspaceKey(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'default';
}

async function writeAgentsMd(workspacePath, task, { codexCwd = workspacePath } = {}) {
  const memories = Array.isArray(task.memories) ? task.memories : [];
  const interaction = task.interaction || (task.kind === 'message_agent' ? 'draft_reply' : 'direct_chat');
  const groups = { must_read: [], starred: [], stored: [] };
  for (const m of memories) {
    const bucket = groups[m.inclusion] || groups.stored;
    bucket.push(m);
  }

  const signature = memorySignature(memories);
  await writeMemoryFiles(workspacePath, memories, groups, signature);

  // 三档差异化注入：
  //   必读   = 标题 + 摘要 + 正文，并显式要求 Codex 内化
  //   星标   = 标题 + 摘要 + 正文（参考，不强制）
  //   只存   = 默认只给数量，不暴露标题/摘要/正文；需要时由 Codex 主动搜索本地记忆文件
  const fmtFull = (m) => {
    const head = `- **${m.title}**`;
    const sum = m.summary ? `: ${m.summary}` : '';
    const body = m.content ? `\n  ${m.content.replace(/\n/g, '\n  ')}` : '';
    return head + sum + body;
  };

  const turns = Array.isArray(task.turns) ? task.turns : [];

  const memoryLines = [
    '## 第二层 · 记忆',
    '',
    `当前共有 ${memories.length} 条记忆：必读 ${groups.must_read.length} 条，星标 ${groups.starred.length} 条，只存 ${groups.stored.length} 条。`,
    '',
    `需要更多背景时，主动搜索 \`${path.join(workspacePath, 'memories/items')}\`，例如：\`rg -n "关键词" ${shellQuote(path.join(workspacePath, 'memories/items'))}\`。搜索到相关条目后再打开对应文件阅读，不要凭空猜测未展开的内容。`,
    '',
    '### 必读',
    '_这些条目你必须内化。处理任何任务前先核对，不要违背。_',
    '',
    groups.must_read.length ? groups.must_read.map(fmtFull).join('\n') : '(无)',
    '',
    '### 星标',
    '_重要参考，按需引用。_',
    '',
    groups.starred.length ? groups.starred.map(fmtFull).join('\n') : '(无)',
    '',
    '### 只存',
    '_默认不展开。这里只告诉你还有多少条；需要时请主动搜索本地记忆文件。_',
    '',
    groups.stored.length ? `只存记忆 ${groups.stored.length} 条。` : '(无)',
    '',
  ];

  const lines = [
    '# Meem Agent',
    '',
    '## 第一层 · 人设',
    '',
    String(task.prompt || '').trim() || '（用户未配置人设）',
    '',
    ...memoryLines,
  ];

  lines.push(
    '## 第三层 · 当前会话',
    '',
    '- 模式: ' + task.mode,
    sessionShapeLine(task, interaction),
    ...participantLines(task),
    '',
    '### 历史对话（旧→新）',
    '',
    turns.length
      ? turns.map(t => formatTurnForContext(t, task)).join('\n\n')
      : '(无)',
    '',
  );

  lines.push(
    '## 规则',
    '',
    '- 如果任务涉及用户机器的真实状态、文件或操作，先按权限模式查清楚或完成操作，再回答。不要凭空猜测或编造结果。',
    outputRuleLine(task, interaction),
  );
  if (task.kind === 'message_agent' && interaction === 'draft_reply') {
    lines.push('- 上下文中的“外部联系人消息”来自第三方；你要替用户起草回复，但不能自行发送。');
    lines.push('- 这是一封回复草稿。语气自然、克制、清楚；不要暴露内部系统、工具、权限模式或处理过程。');
    lines.push('- 草稿不会自动发给对方。用户会在消息中决定是否采用、修改和发送。');
  } else if (task.kind === 'message_agent') {
    lines.push('- 上下文中的“用户内部追问”是用户本人对你说的话，不是外部联系人的新消息。');
    lines.push('- 这是围绕外部消息的内部讨论。输出只给用户看，不会发给任何第三方。');
    lines.push('- 可以解释判断、列选项、提出澄清问题；不要把回答伪装成已经发送给外部联系人的消息。');
  } else {
    lines.push('- 这是和用户本人的直接对话，输出会作为代理回复显示给用户，不会发给任何第三方。可以自由发问澄清，可以汇报你看到的、做了的事。');
  }
  lines.push(
    `- 你的 Codex 工作目录是：${codexCwd}`,
    `- Meem 会话上下文目录是：${workspacePath}`,
    '',
  );

  const text = lines.join('\n');
  await fsp.writeFile(path.join(workspacePath, 'AGENTS.md'), text);
  return { signature, text };
}

async function resolveCodexCwd(input, fallback) {
  const raw = String(input || '').trim();
  if (!raw) return fallback;
  const expanded = raw === '~' || raw.startsWith('~/')
    ? path.join(os.homedir(), raw.slice(2))
    : raw;
  const resolved = path.resolve(expanded);
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`工作目录不存在：${resolved}`);
  }
  return resolved;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function sessionShapeLine(task, interaction) {
  if (task.kind !== 'message_agent') {
    return '- 形态: **和用户本人直接对话**（所有输出仅给用户看，不会发给任何第三方）。';
  }
  if (interaction === 'internal_discussion') {
    return '- 形态: **围绕外部消息和用户内部讨论**。输出只给用户看，用于继续分析、修改草稿或决定如何回复。';
  }
  return '- 形态: **处理外部消息并起草回复**。最终输出是一条可采用的回复草稿，不会自动发送给外部联系人。';
}

function outputRuleLine(task, interaction) {
  if (task.kind !== 'message_agent') {
    return '- 总结回复用一段中文，文本即可，不要加引号或代码块包裹整段。需要展示命令输出时可以用 ``` 块。';
  }
  if (interaction === 'internal_discussion') {
    return '- 直接回答用户这次内部追问。可以分点说明；不要输出“已发送”“已回复对方”之类会造成误解的话。';
  }
  return '- 只输出可以直接发送给对方的回复正文。不要解释你如何处理，不要写标题，不要用代码块包裹整段。';
}

function participantLines(task) {
  if (task.kind !== 'message_agent') return [];
  const contact = task.contact || {};
  const name = String(contact.name || '').trim() || '访客';
  const address = String(contact.address || '').trim();
  return [
    `- 用户本人: Meem 所有者。`,
    `- 外部联系人: ${name}${address ? `（${address}）` : ''}。`,
  ];
}

function turnLabel(turn, task) {
  const label = String(turn?.label || '').trim();
  if (label) return label;
  if (task.kind !== 'message_agent') {
    return turn?.role === 'assistant' ? '你' : '我';
  }
  switch (turn?.actor) {
    case 'external_contact':
      return '外部联系人消息';
    case 'sent_to_contact':
      return '已发给外部联系人的回复';
    case 'owner':
      return '用户内部追问';
    case 'codex_internal':
      return 'Codex 内部回复';
    default:
      return turn?.role === 'assistant' ? 'Codex 内部回复' : '用户内部追问';
  }
}

function turnContent(turn) {
  return String(turn?.content || '').trim();
}

function turnInstruction(turn) {
  return String(turn?.instruction || '').trim();
}

function formatTurnForPrompt(turn, task, { history = false } = {}) {
  const content = turnContent(turn);
  const instruction = turnInstruction(turn);
  if (!content) return '';
  if (task.kind !== 'message_agent' && !turn?.label && !turn?.actor && !instruction) {
    return history ? `${turn?.role === 'assistant' ? '你' : '我'}: ${content}` : content;
  }
  return [
    `【${turnLabel(turn, task)}】`,
    content,
    instruction ? `处理要求：${instruction}` : '',
  ].filter(Boolean).join('\n');
}

function formatTurnForContext(turn, task) {
  const content = turnContent(turn) || '(空)';
  const instruction = turnInstruction(turn);
  return [
    `#### ${turnLabel(turn, task)}`,
    content,
    instruction ? `处理要求：${instruction}` : '',
  ].filter(Boolean).join('\n');
}

function memorySignature(memories) {
  const payload = memories.map((m) => ({
    id: m.id,
    title: m.title || '',
    summary: m.summary || '',
    content: m.content || '',
    inclusion: m.inclusion || 'stored',
    updated_at: m.updated_at || 0,
  }));
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function writeMemoryFiles(workspacePath, memories, groups, signature) {
  const memoryDir = path.join(workspacePath, 'memories');
  const itemsDir = path.join(memoryDir, 'items');
  await fsp.rm(memoryDir, { recursive: true, force: true });
  await fsp.mkdir(itemsDir, { recursive: true });

  await fsp.writeFile(path.join(memoryDir, 'manifest.json'), JSON.stringify({
    signature,
    total: memories.length,
    counts: {
      must_read: groups.must_read.length,
      starred: groups.starred.length,
      stored: groups.stored.length,
    },
    search_hint: 'Use `rg -n "关键词" ./memories/items` from the session workspace, then open matching item files.',
  }, null, 2));

  await fsp.writeFile(path.join(memoryDir, 'README.md'), [
    '# Meem Memories',
    '',
    `Total: ${memories.length}`,
    `Must read: ${groups.must_read.length}`,
    `Starred: ${groups.starred.length}`,
    `Stored: ${groups.stored.length}`,
    '',
    'Search with:',
    '',
    '```bash',
    'rg -n "关键词" ./memories/items',
    '```',
    '',
    'Open matching files only when their content is relevant to the current task.',
    '',
  ].join('\n'));

  for (const m of memories) {
    const id = safeWorkspaceKey(m.id || `${m.inclusion}-${m.title}`);
    const body = [
      `# ${m.title || '(untitled)'}`,
      '',
      `id: ${m.id || ''}`,
      `inclusion: ${m.inclusion || 'stored'}`,
      m.summary ? `summary: ${m.summary}` : 'summary:',
      '',
      String(m.content || ''),
      '',
    ].join('\n');
    await fsp.writeFile(path.join(itemsDir, `${id}.md`), body);
  }
}

async function api(method, urlPath, body) {
  const r = await fetch(`${MEEM_BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${urlPath} → ${r.status}`);
  return r.json().catch(() => ({}));
}

export const meem = {
  status() {
    return {
      hasToken: Boolean(token),
      connected: socket?.readyState === WebSocket.OPEN,
      connectedAt,
      lastError,
      base: MEEM_BASE,
    };
  },
  async init() {
    startCodexProbeLoop();
    // 启动时清掉旧的 thread state——bridge 重启 / Codex app-server 重启会让旧 thread id 失效
    try {
      const entries = await fsp.readdir(MEEM_WORKSPACES_DIR).catch(() => []);
      await Promise.all(entries.map(async (name) => {
        const f = path.join(MEEM_WORKSPACES_DIR, name, 'meem-thread.json');
        await fsp.unlink(f).catch(() => {});
      }));
    } catch {}
    token = await loadStoredToken();
    if (token) connect();
  },
  async setToken(next) {
    const t = String(next || '').trim();
    if (!t) return;
    if (t === token) return;
    token = t;
    await persistToken(t);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    reconnectMs = RECONNECT_MIN;
    connect();
  },
};
