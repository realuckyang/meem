import { newId, now } from '../lib/id';
import { messagePreview } from '../lib/normalize';
import { loadConversation } from '../repository/conversations';
import { loadMemoriesForUser } from '../repository/memories';
import { listMessageHistory, loadMessageForAgent } from '../repository/messages';
import { createMessageAgentSession } from '../repository/sessions';
import { loadSettings } from '../repository/settings';
import type { Env } from '../types';
import { notifyHub } from './hub';

export async function dispatchMessageAgentTask(env: Env, userId: string, conversationId: string, messageId: string) {
  const settings = await loadSettings(env, userId);
  const memories = await loadMemoriesForUser(env, userId);
  const conversation = await loadConversation(env, userId, conversationId) as any;
  const message = await loadMessageForAgent(env, userId, messageId);
  if (!conversation || !message) return;

  const history = await listMessageHistory(env, userId, conversationId);
  const contactName = conversation.contact_name || message.sender_name || '访客';
  const turns: any[] = history
    .filter((item) => item.id !== message.id)
    .map((item) => ({
      role: item.direction === 'outbound' ? 'assistant' : 'user',
      actor: item.direction === 'outbound' ? 'sent_to_contact' : 'external_contact',
      label: item.direction === 'outbound'
        ? '已发给外部联系人的回复'
        : `外部联系人 ${item.sender_name || contactName} 的历史消息`,
      content: item.body,
    }));
  turns.push({
    role: 'user',
    actor: 'external_contact',
    label: `外部联系人 ${contactName} 的当前消息`,
    content: message.body,
    instruction: '请代表用户生成一条可以直接发送给对方的回复。只输出回复正文。',
  });

  const sessionId = newId();
  const title = messagePreview(message.body).slice(0, 80) || conversation.title || '处理消息';
  const ts = now();
  await createMessageAgentSession(env, {
    id: sessionId,
    userId,
    title,
    conversationId,
    messageId,
    ts,
  });

  await notifyHub(env, userId, { type: 'session-started', session: {
    id: sessionId,
    user_id: userId,
    kind: 'message_agent',
    status: 'thinking',
    title,
    conversation_id: conversationId,
    trigger_message_id: messageId,
    created_at: ts,
    updated_at: ts,
    finished_at: null,
  }});

  await notifyHub(env, userId, {
    type: 'agent-task',
    task: {
      session_id: sessionId,
      kind: 'message_agent',
      mode: settings.mode_message_agent,
      owner_id: userId,
      peer_id: conversation.contact_id,
      conversation_id: conversationId,
      message_id: messageId,
      contact: {
        name: contactName,
        address: conversation.contact_address || message.sender_address || '',
      },
      trigger: {
        content: message.body,
        sender_id: conversation.contact_id,
        created_at: message.created_at,
      },
      prompt: settings.prompt,
      memories,
      interaction: 'draft_reply',
      history,
      turns,
      trigger_message_id: messageId,
      title: conversation.title,
    },
  });
}
