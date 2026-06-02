import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { resolve } from 'node:path';
import { Jimp } from 'jimp';
import { commandExists, defaultScreenshotPath, ensureParent, fileSize, run } from '../../system/utils.js';

export async function screenshot(args) {
  const outputPath = resolve(String(args.outputPath || defaultScreenshotPath()));
  const os = platform();
  let res;
  if (os === 'darwin') res = await macScreenshot(outputPath);
  else if (os === 'linux') res = await linuxScreenshot(outputPath);
  else if (os === 'win32') res = await windowsScreenshot(outputPath);
  else throw new Error(`unsupported_platform: ${os}`);
  // 同时回传 base64 dataUrl,供视觉模型直接读取(worker 读不到本机磁盘)
  return { ...res, dataUrl: await encodeDataUrl(res) };
}

const MAX_SIDE = 1568; // 视觉模型有效长边上限,再大只是浪费
const JPEG_Q = 80;

/** 适当压缩:长边降到 MAX_SIDE 并转 JPEG(纯 JS · jimp,跨平台无系统依赖);失败回退原图 */
async function encodeDataUrl(res) {
  try {
    const img = await Jimp.read(res.outputPath);
    if (Math.max(img.width, img.height) > MAX_SIDE) img.scaleToFit({ w: MAX_SIDE, h: MAX_SIDE });
    const buf = await img.getBuffer('image/jpeg', { quality: JPEG_Q });
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    const raw = await readFile(res.outputPath);
    return `data:image/${res.format};base64,${raw.toString('base64')}`;
  }
}

async function macScreenshot(outputPath) {
  await ensureParent(outputPath);
  await run('screencapture', ['-x', '-t', 'png', outputPath]);
  return { outputPath, format: 'png', bytes: await fileSize(outputPath) };
}

async function linuxScreenshot(outputPath) {
  await ensureParent(outputPath);
  if (await commandExists('gnome-screenshot')) {
    await run('gnome-screenshot', ['-f', outputPath]);
  } else if (await commandExists('scrot')) {
    await run('scrot', [outputPath]);
  } else if (await commandExists('import')) {
    await run('import', ['-window', 'root', outputPath]);
  } else {
    throw new Error('missing_linux_screenshot_tool: install gnome-screenshot, scrot, or imagemagick');
  }
  return { outputPath, format: 'png', bytes: await fileSize(outputPath) };
}

async function windowsScreenshot(outputPath) {
  await ensureParent(outputPath);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save(${JSON.stringify(outputPath)}, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()
`;
  await run('powershell.exe', ['-NoProfile', '-Command', script]);
  return { outputPath, format: 'png', bytes: await fileSize(outputPath) };
}
