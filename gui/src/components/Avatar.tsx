interface Props {
  handle: string;
  name?: string;
  size?: number;
}

function color(handle: string) {
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return `hsl(${h % 360},55%,55%)`;
}

export default function Avatar({ handle, name, size = 36 }: Props) {
  const label = (name || handle).slice(0, 1).toUpperCase();
  return (
    <div
      className="flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color(handle),
        fontSize: size * 0.42,
      }}
    >
      {label}
    </div>
  );
}
