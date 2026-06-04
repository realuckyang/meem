/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  DOWNLOADS: R2Bucket;
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  // 模型配置改由「设置」应用写入 D1(settings),不再放 wrangler.jsonc;以下保留为可选兜底。
  LLM_URL?: string;
  LLM_KEY?: string;
  LLM_MODEL?: string;
  LLM_MAX_ROUNDS?: string;
  LLM_TOOL_TIMEOUT_MS: string;
  LLM_VISION: string;
}

export interface ConnectionStatus { computer: boolean; browser: boolean; }

/** 设备信息(注入给 agent + 推给控制台)· online 来自实时连接 */
export interface DeviceInfo { id: string; kind: string; name: string; description: string; online: boolean; }
