import { useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/api';
import { useMe } from '../lib/me';
import Avatar from '../components/Avatar';
import { useConnectionStatus } from '../components/ConnectionStatus';

const MODE_LABEL: Record<string, string> = {
  auto: '自动回复',
  review: '审批后回复',
};

export default function Settings() {
  const navigate = useNavigate();
  const { me, logout } = useMe();
  const status = useConnectionStatus();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <header className="h-14 flex items-center px-4 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0 sticky top-0 z-10">
        <span className="text-[17px] font-semibold">设置</span>
      </header>

      {/* 头像区作为 profile 入口 */}
      <button
        onClick={() => navigate('/settings/profile')}
        className="flex items-center gap-3.5 px-4 py-5 bg-white border-b border-neutral-200 w-full text-left active:bg-neutral-50"
      >
        <Avatar handle={me.handle} name={me.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold truncate">{me.name || me.handle}</div>
          <div className="text-sm text-neutral-400 mt-0.5 truncate">
            {me.bio || `@${me.handle}`}
          </div>
        </div>
        <span className="text-neutral-300 text-lg flex-shrink-0">›</span>
      </button>

      <Section title="能力">
        <Row
          icon="🧠"
          label="自我更新"
          value="记忆"
          onClick={() => navigate('/settings/memory')}
        />
        <PluginRow status={status} onClick={() => navigate('/settings/extension')} />
        <Row
          icon="🖥️"
          label="电脑控制"
          value="敬请期待"
          dim
          last
        />
      </Section>

      <Section title="智能体">
        <Row icon="🤖" label="大模型" value={me.settings.model || '未配置'} onClick={() => navigate('/settings/model')} />
        <Row icon="🪪" label="人设" value={me.settings.prompt ? `${me.settings.prompt.length} 字` : '未配置'} onClick={() => navigate('/settings/persona')} />
        <Row icon="⚙️" label="模式" value={MODE_LABEL[me.settings.mode]} onClick={() => navigate('/settings/mode')} />
        <Row icon="📏" label="对话限制" value={`${me.settings.max_rounds} 轮`} onClick={() => navigate('/settings/limits')} last />
      </Section>

      <div className="px-4 pt-8 pb-10">
        <button className="btn-danger" onClick={() => { clearToken(); logout(); }}>退出登录</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 pt-6">
      <div className="px-1 pb-2 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">{title}</div>
      <div className="bg-white rounded-xl overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, onClick, last, dim }: { icon: string; label: string; value?: string; onClick?: () => void; last?: boolean; dim?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left ${dim ? '' : 'active:bg-neutral-50'} ${last ? '' : 'border-b border-neutral-100'} ${dim ? 'opacity-60' : ''}`}
    >
      <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
      <span className="flex-1 text-[15px]">{label}</span>
      {value && <span className="text-sm text-neutral-400 truncate max-w-[50%]">{value}</span>}
      {onClick && <span className="text-neutral-300 text-lg flex-shrink-0">›</span>}
    </button>
  );
}

function PluginRow({ status, onClick }: { status: { extension: boolean; web: boolean }; onClick: () => void }) {
  const ok = status.extension;
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full px-4 py-3 text-left active:bg-neutral-50 border-b border-neutral-100">
      <span className="text-lg w-6 text-center flex-shrink-0">🌐</span>
      <span className="flex-1 text-[15px]">浏览器控制</span>
      <span className={`flex items-center gap-1.5 text-sm ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {ok ? '已连接' : '未连接'}
      </span>
      <span className="text-neutral-300 text-lg flex-shrink-0">›</span>
    </button>
  );
}
