export interface Item {
  id: string;
  kind: 'dynamic' | 'article' | 'project' | 'about';
  title: string;
  body: string;
  url: string;
  tags: string;
  created: number;
}

export type Msg = { role: 'user' | 'assistant'; content: string };

export interface Profile { id: string; email: string; name: string }
export interface Auth { token: string; profile: Profile }

export interface ContactInfo { label: string; value: string; url?: string; code?: boolean }
