import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '../extension/meem-extension.zip');
const target = resolve(root, 'gui/dist/downloads/extension/meem-extension.zip');

try {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log('copied extension package');
} catch {
  console.warn('extension package not found; skip downloads/extension asset');
}
