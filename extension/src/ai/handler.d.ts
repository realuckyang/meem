import type { ChatEvent, ChatMessage } from './types';

export function chat(
  messages: ChatMessage[],
  options?: {
    provider?: string;
    apiUrl?: string;
    apiKey?: string;
    model?: string;
    onEvent?: (event: ChatEvent) => void;
    signal?: AbortSignal;
    maxRounds?: number;
    enableToolResultTruncate?: boolean;
    toolResultMaxChars?: number;
  }
): Promise<{ text: string; messages: ChatMessage[] }>;
