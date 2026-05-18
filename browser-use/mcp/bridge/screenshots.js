import fsp from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function normalizeScreenshotFormat(value) {
  const format = String(value || '').trim().toLowerCase();
  return ['png', 'jpeg', 'webp'].includes(format) ? format : 'png';
}

function screenshotExtension(format) {
  return format === 'jpeg' ? 'jpg' : format;
}

async function saveBrowserScreenshot(result, { directory, format }) {
  const data = result?.screenshot?.data;
  if (!data) {
    throw new Error('Browser did not return screenshot data.');
  }

  await fsp.mkdir(directory, { recursive: true });
  const filename = [
    'meem-browser-bridge',
    new Date().toISOString().replace(/[:.]/g, '-'),
    randomUUID(),
  ].join('-') + `.${screenshotExtension(format)}`;
  const filePath = path.join(directory, filename);
  const bytes = Buffer.from(data, 'base64');
  await fsp.writeFile(filePath, bytes);

  return {
    path: filePath,
    fileUrl: pathToFileURL(filePath).href,
    format,
    bytes: bytes.length,
    tabId: result.tabId,
    url: result.url || '',
    title: result.title || '',
  };
}

export { normalizeScreenshotFormat, saveBrowserScreenshot };
