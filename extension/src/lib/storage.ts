import { defaultSettings } from '../ai/providers';
import type { ChatMessage, ChatSettings } from '../ai/types';

const SETTINGS_KEY = 'meem.settings';
const MESSAGES_KEY = 'meem.messages';

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const data = await chrome.storage.local.get(key);
    return (data[key] as T | undefined) ?? fallback;
  }
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export async function loadSettings(): Promise<ChatSettings> {
  return { ...defaultSettings, ...(await getLocal<Partial<ChatSettings>>(SETTINGS_KEY, {})) };
}

export async function saveSettings(settings: ChatSettings): Promise<void> {
  await setLocal(SETTINGS_KEY, settings);
}

export async function loadMessages(): Promise<ChatMessage[]> {
  return getLocal<ChatMessage[]>(MESSAGES_KEY, []);
}

export async function saveMessages(messages: ChatMessage[]): Promise<void> {
  await setLocal(MESSAGES_KEY, messages);
}
