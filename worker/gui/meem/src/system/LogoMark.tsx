import { cn } from './lib/utils';

interface LogoMarkProps {
  className?: string;
  label?: string;
}

export default function LogoMark({ className, label = 'Meem' }: LogoMarkProps) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-xl bg-foreground font-black tracking-normal text-background shadow-sm',
        className,
      )}
      aria-label={label}
      role="img"
    >
      M
    </span>
  );
}
