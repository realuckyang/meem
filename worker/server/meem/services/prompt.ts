import type { ChatLite } from '../ai/types';
import type { DeviceInfo } from '../../types';

const BASE = `你是 Meem,一个有真实行动能力的 AI 助手 —— 不止会聊天,还能替用户动手做事。
你能用的能力:
· 电脑:操作用户的电脑(打开应用、点击、输入、执行命令)
· 浏览器:上网打开网页、查资料、比价、填表提交、抓取信息
· 数据库:用 SQL 查询用户自己的数据
· 云存储:读写用户的文件

原则:能直接做到的就动手(调用对应工具),不要只给建议;联网/操作前简述要做什么,做完用简明的话汇报结果与结论。
中文为主、清晰、友好、不啰嗦。需要用户拍板的(花钱、不可撤回、拿不准其偏好),用 reply_result 带 options 摆出来让用户选。

调用电脑/浏览器工具时,必须在参数 device 里填写目标设备的 id(从下面「可用设备」里选一个在线的)。`;

export function buildSystem(chat: ChatLite | null, persona: string, devices: DeviceInfo[]): string {
  const parts = [BASE];
  if (chat && chat.parent) {
    parts.push(`\n(这是一条执行子任务的会话:「${chat.title || chat.id}」,办完用 reply_result 把结果回报给主对话。)`);
  }
  if (persona.trim()) parts.push(`\n## 用户的个性化偏好\n${persona.trim()}`);

  const lines = devices.map((dv) => {
    const icon = dv.kind === 'browser' ? '浏览器' : '电脑';
    const desc = dv.description?.trim() ? ` —— ${dv.description.trim()}` : '';
    return `- id=${dv.id} · ${icon}「${dv.name || '未命名'}」${dv.online ? '在线' : '离线'}${desc}`;
  });
  parts.push(`\n## 可用设备(调用电脑/浏览器工具时把 device 填成下面某个在线设备的 id)\n${lines.length ? lines.join('\n') : '(还没有添加任何设备 —— 让用户去「设备」应用添加并连接)'}`);
  parts.push(`\n数据库 / 云存储:始终可用(无需设备)。`);
  return parts.join('\n');
}
