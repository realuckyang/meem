export type Tab = 'messages' | 'contacts' | 'feed' | 'agents' | 'me';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'messages', label: '消息',   icon: '💬' },
  { key: 'contacts', label: '联系人', icon: '👥' },
  { key: 'feed',     label: '广播',   icon: '📣' },
  { key: 'agents',   label: '智能体', icon: '🤖' },
  { key: 'me',       label: '我',     icon: '👤' },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="h-14 flex border-t border-neutral-200 bg-white/90 backdrop-blur">
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${on ? 'text-accent' : 'text-neutral-400'}`}
            onClick={() => onChange(t.key)}
          >
            <span
              className="text-xl leading-none transition-all"
              style={on ? undefined : { filter: 'grayscale(1)', opacity: 0.45 }}
            >
              {t.icon}
            </span>
            <span className={`text-[11px] ${on ? 'font-medium' : ''}`}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
