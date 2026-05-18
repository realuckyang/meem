import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_DIR = process.env.MEEM_SERVER_DIR || path.resolve(SRC_DIR, '..');
export const MEEM_HOME = process.env.MEEM_HOME || path.join(os.homedir(), '.meem');
export const MEEM_DATA_DIR = process.env.MEEM_DATA_DIR || MEEM_HOME;
export const MEEM_WORKSPACES_DIR = process.env.MEEM_WORKSPACES_DIR || path.join(MEEM_HOME, 'workspaces');
export const SERVER_TOKEN_FILE = process.env.MEEM_TOKEN_FILE || path.join(SERVER_DIR, 'token.json');

export function workspaceForSession(sessionId, basePath = MEEM_WORKSPACES_DIR) {
  const root = String(basePath || '').trim() || MEEM_WORKSPACES_DIR;
  return path.join(root, safePathName(sessionId || 'default'));
}

function safePathName(value) {
  const name = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || 'default';
}
