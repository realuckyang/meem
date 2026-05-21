import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  back?: string;
  onSave?: () => void;
  saving?: boolean;
}

export default function SubHeader({ title, back = '/settings', onSave, saving }: Props) {
  const navigate = useNavigate();
  return (
    <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
      <button onClick={() => navigate(back)} className="text-2xl text-accent px-1 leading-none">‹</button>
      <span className="text-[17px] font-semibold flex-1">{title}</span>
      {onSave && (
        <button onClick={onSave} disabled={saving} className="text-accent font-medium px-2 disabled:opacity-40">
          {saving ? '…' : '保存'}
        </button>
      )}
    </header>
  );
}
