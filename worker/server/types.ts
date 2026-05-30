/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  DOWNLOADS: R2Bucket;
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  LLM_URL: string;
  LLM_KEY: string;
  LLM_MODEL: string;
  LLM_MAX_ROUNDS: string;
  LLM_TOOL_TIMEOUT_MS: string;
  LLM_VISION: string;
}

export interface ConnectionStatus { computer: boolean; browser: boolean; }
