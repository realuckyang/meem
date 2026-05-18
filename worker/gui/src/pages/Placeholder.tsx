export default function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="h-full flex flex-col">
      <header className="h-12 shrink-0 flex items-center px-4 border-b bg-white font-semibold">{title}</header>
      <div className="flex-1 grid place-items-center p-10 text-center text-neutral-400 text-sm">{body}</div>
    </div>
  );
}
