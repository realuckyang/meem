export interface Env {
  DB: D1Database;
  HUB: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export type AppVariables = {
  userId: string;
};

export type Mode = 'observe' | 'approval' | 'managed';
export type SessionKind = 'direct_chat' | 'message_agent';
export type SessionStatus =
  | 'thinking'
  | 'awaiting_approval'
  | 'awaiting_input'
  | 'done'
  | 'cancelled'
  | 'errored';

export type AuthUser = {
  id: string;
  handle: string;
  name: string;
  password_salt: string | null;
  password_hash: string | null;
  auth_secret: string | null;
};

export type Settings = {
  prompt: string;
  public_messages_enabled: boolean;
  mode_direct: Mode;
  mode_message_agent: Mode;
};

export type DispatchSession = {
  id: string;
  user_id: string;
  kind: SessionKind;
  title: string | null;
  conversation_id: string | null;
  trigger_message_id: string | null;
  cwd?: string | null;
};

export type PublicMessageInput = {
  handle?: string;
  sender_name?: string;
  sender_address?: string;
  text?: string;
};

export type SendMessageInput = {
  address?: string;
  contact_name?: string;
  text?: string;
};

export type Inclusion = 'must_read' | 'starred' | 'stored';

export type Memory = {
  id: string;
  title: string;
  summary: string;
  content: string;
  inclusion: Inclusion;
  created_at: number;
  updated_at: number;
};
