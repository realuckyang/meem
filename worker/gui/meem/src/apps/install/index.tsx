import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, FolderOpen, Monitor, Puzzle, TerminalSquare } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { api } from '../../system/lib/api';
import { Button } from '../../system/ui/button';

type InstallKind = 'client' | 'extension';

export default function InstallApp({ kind, openApps }: SystemAppProps & { kind: InstallKind }) {
  const [config, setConfig] = useState<{ baseUrl: string; wsUrl: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api.installConfig().then(setConfig).catch(() => {}); }, []);

  const configCode = useMemo(() => config ? `// client/config.js · 不入 git
export const BASE_URL = '${config.baseUrl}';
export const WS_URL   = '${config.wsUrl}';
export const TOKEN    = '${config.token}';
` : '', [config]);

  function copy() {
    if (!configCode) return;
    navigator.clipboard?.writeText(configCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  }

  function downloadConfig() {
    if (!configCode) return;
    const blob = new Blob([configCode], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isClient = kind === 'client';

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <Topbar title={isClient ? '安装本机客户端' : '安装浏览器扩展'} openApps={openApps} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-5xl gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-lg bg-secondary text-foreground [&_svg]:size-6">
                {isClient ? <Monitor /> : <Puzzle />}
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-normal">{isClient ? '本机客户端' : 'Chrome 扩展'}</h1>
                <p className="text-sm text-muted-foreground">{isClient ? '让 Meem 使用终端、文件、截图和电脑工具。' : '让 Meem 使用当前浏览器和登录态网页。'}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
              {isClient ? (
                <>
                  <Step n={1}>进入仓库的 <code>client</code> 目录。</Step>
                  <Step n={2}>把右侧生成的 <code>config.js</code> 放到 <code>client/config.js</code>。</Step>
                  <Step n={3}>运行 <code>npm install</code>，然后运行 <code>npm start</code>。</Step>
                  <Step n={4}>保持终端窗口运行，Meem 会自动显示电脑已连接。</Step>
                </>
              ) : (
                <>
                  <Step n={1}>下载并解压扩展包，或直接使用仓库里的 <code>extension</code> 目录。</Step>
                  <Step n={2}>打开 <code>chrome://extensions</code> 并开启开发者模式。</Step>
                  <Step n={3}>点击“加载已解压的扩展程序”，选择解压目录。</Step>
                  <Step n={4}>打开扩展 popup，输入 Meem 密码完成登录。</Step>
                </>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            {isClient ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">client/config.js</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copy}>{copied ? '已复制' : '复制'}</Button>
                    <Button size="sm" onClick={downloadConfig}><Download />下载</Button>
                  </div>
                </div>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-5">{configCode || '生成中...'}</pre>
                <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <TerminalSquare className="size-4" />
                  <code>cd client && npm install && npm start</code>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-semibold">扩展包</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">下载 zip 后解压，再用 Chrome 加载解压后的目录。开发环境也可以直接加载仓库里的 extension 目录。</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild>
                    <a href="/downloads/extension/meem-extension.zip" download="meem-extension.zip"><Download />下载扩展包</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="chrome://extensions" target="_blank" rel="noreferrer"><FolderOpen />打开扩展管理</a>
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground">{n}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
