// 按 handle / 名字哈希出一个 hue，给每个联系人/用户一个稳定的色相
function hashHue(seed: string): number {
  if (!seed) return 220;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function initialOf(value: string) {
  return (value || '?').trim().slice(0, 1).toUpperCase();
}

export default function Avatar({
  seed, label, size = 28, className,
}: {
  seed: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  const hue = hashHue(seed);
  const bg = `hsl(${hue} 38% 50%)`;
  return (
    <div
      className={`rounded-full grid place-items-center font-semibold text-white shrink-0 ${className || ''}`}
      style={{ width: size, height: size, background: bg, fontSize: Math.max(10, size * 0.4) }}
    >
      {initialOf(label || seed)}
    </div>
  );
}
