export default function TabButton({ label, icon, active, onClick }: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center text-xs gap-0.5 transition-opacity ${
        active
          ? 'text-neutral-900 font-medium opacity-100'
          : 'text-neutral-500 opacity-40 hover:opacity-70'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
