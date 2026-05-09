import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const AGENTS_PATH = path.join(ROOT_DIR, 'AGENTS.md');
const DEFAULT_CONTENT = `# Meem

Meem 是面向 agent 的本地工作台。

## 核心模块

- 动态：记录项目和工作的关键变化。
- 文档：集中管理项目规则、总览和研究材料。
- 文件：浏览、预览和引用本机文件。
- 终端：执行本地命令和管理会话。
- 屏幕：查看当前屏幕上下文。
- 对话：和 agent 协作处理任务。
`;

function ensureFile() {
    if (!fs.existsSync(AGENTS_PATH)) {
        fs.writeFileSync(AGENTS_PATH, DEFAULT_CONTENT, 'utf8');
    }
}

function getHome() {
    ensureFile();
    const stat = fs.statSync(AGENTS_PATH);
    return {
        path: AGENTS_PATH,
        content: fs.readFileSync(AGENTS_PATH, 'utf8'),
        updated_at: stat.mtimeMs,
    };
}

function updateHome(input = {}) {
    const content = String(input.content ?? '');
    fs.writeFileSync(AGENTS_PATH, content, 'utf8');
    return getHome();
}

export default { getHome, updateHome };
