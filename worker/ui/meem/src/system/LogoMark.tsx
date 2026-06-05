import { cn } from './lib/utils';

interface LogoMarkProps {
  className?: string;
  label?: string;
}

export default function LogoMark({ className, label = 'Meem' }: LogoMarkProps) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-xl border border-cyan bg-cyan/10 font-black tracking-normal text-cyan shadow-glow-sm',
        className,
      )}
      aria-label={label}
      role="img"
    >
      M
    </span>
  );
}
