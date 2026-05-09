<script setup>
import { ref } from 'vue';

const THEME_KEY = 'meem_theme';
const theme = ref(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function setTheme(value) {
    theme.value = value;
    document.documentElement.dataset.theme = value;
    localStorage.setItem(THEME_KEY, value);
}
</script>

<template>
    <div class="flex-1 min-h-0 overflow-y-auto bg-bg text-ink">
        <div class="mx-auto max-w-2xl px-4 py-5">
            <header class="mb-5">
                <h1 class="text-[22px] font-semibold font-serif">设置</h1>
            </header>

            <section class="border border-line bg-bg-elev rounded-[10px] overflow-hidden">
                <div class="flex items-center justify-between gap-4 px-4 py-4 border-b border-line">
                    <div class="min-w-0">
                        <div class="text-sm font-medium text-ink">外观</div>
                        <div class="mt-1 text-xs text-muted">切换 Meem 的明暗主题</div>
                    </div>
                    <div class="shrink-0 inline-flex rounded-[10px] border border-line bg-bg p-1">
                        <button @click="setTheme('dark')"
                            class="h-8 px-3 rounded text-xs transition-colors"
                            :class="theme === 'dark'
                                ? 'bg-bg-hi text-ink'
                                : 'text-muted hover:text-ink'">
                            暗色
                        </button>
                        <button @click="setTheme('light')"
                            class="h-8 px-3 rounded text-xs transition-colors"
                            :class="theme === 'light'
                                ? 'bg-bg-hi text-ink'
                                : 'text-muted hover:text-ink'">
                            明色
                        </button>
                    </div>
                </div>

                <div class="px-4 py-4">
                    <div class="text-sm font-medium text-ink">远程访问</div>
                    <div class="mt-1 text-xs leading-relaxed text-muted">
                        远程模块用于把本机 Meem 临时暴露给其他设备访问。当前版本只提供说明，不会自动启动隧道或修改网络配置。
                    </div>

                    <div class="mt-4 space-y-3 text-xs leading-relaxed text-muted">
                        <div>
                            <div class="mb-1 font-medium text-ink">基本思路</div>
                            <p>Meem 默认监听本机地址。需要远程访问时，可以用 ngrok、cloudflared tunnel、Tailscale Funnel 或 SSH 端口转发把本机端口代理出去。</p>
                        </div>

                        <div>
                            <div class="mb-1 font-medium text-ink">推荐步骤</div>
                            <ol class="list-decimal space-y-1 pl-4">
                                <li>确认本机服务正在运行，默认地址是 <code class="rounded bg-bg px-1 py-0.5 font-mono text-accent">http://127.0.0.1:9001</code>。</li>
                                <li>在 <code class="rounded bg-bg px-1 py-0.5 font-mono text-accent">server/config.js</code> 里设置 <code class="rounded bg-bg px-1 py-0.5 font-mono text-accent">SESSION_PASSWORD</code>，避免远程裸奔。</li>
                                <li>使用隧道工具把 <code class="rounded bg-bg px-1 py-0.5 font-mono text-accent">9001</code> 端口暴露出去。</li>
                                <li>在远程设备打开隧道地址，输入访问密码后使用。</li>
                            </ol>
                        </div>

                        <div>
                            <div class="mb-1 font-medium text-ink">示例命令</div>
                            <div class="rounded border border-line bg-bg px-3 py-2 font-mono text-[11px] text-ink">
                                ngrok http 9001
                            </div>
                            <div class="mt-2 rounded border border-line bg-bg px-3 py-2 font-mono text-[11px] text-ink">
                                cloudflared tunnel --url http://127.0.0.1:9001
                            </div>
                        </div>

                        <div class="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-accent-hi">
                            远程访问会暴露终端、文件和文档能力。只在可信网络或临时隧道里使用，并且一定设置访问密码。
                        </div>
                    </div>
                </div>

                <div class="border-t border-line px-4 py-4">
                    <div class="text-sm font-medium text-ink">关于 Meem</div>
                    <div class="mt-1 text-xs leading-relaxed text-muted">
                        Meem 是面向 agent 的文档集中层，也是本地工作的管理层、档案层和操作层。
                    </div>

                    <div class="mt-4 grid gap-3 text-xs leading-relaxed text-muted sm:grid-cols-3">
                        <div class="rounded border border-line bg-bg px-3 py-3">
                            <div class="mb-1 font-medium text-ink">管理层</div>
                            <p>统一整理项目、文档、终端、文件和会话入口，让 agent 工作有明确上下文。</p>
                        </div>
                        <div class="rounded border border-line bg-bg px-3 py-3">
                            <div class="mb-1 font-medium text-ink">档案层</div>
                            <p>沉淀规则、研究、项目总览和过程记录，避免重要信息散落在聊天和临时文件里。</p>
                        </div>
                        <div class="rounded border border-line bg-bg px-3 py-3">
                            <div class="mb-1 font-medium text-ink">操作层</div>
                            <p>连接文件、终端、屏幕和 agent 行动，把文档从记录变成可执行的工作界面。</p>
                        </div>
                    </div>

                    <div class="mt-4 rounded border border-line bg-bg px-3 py-2 text-xs text-muted">
                        欢迎交流：微信 <span class="font-mono text-accent">agentready</span>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>
