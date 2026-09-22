export function Mascot() {
  return (
    <div className="relative mx-auto h-32 w-32">
      <div className="absolute inset-3 rounded-full border-4 border-slate-900 bg-yellow-300 shadow-[0_7px_0_rgba(15,23,42,0.2)]" />
      <div className="absolute left-9 top-12 h-4 w-4 rounded-full bg-slate-900" />
      <div className="absolute right-9 top-12 h-4 w-4 rounded-full bg-slate-900" />
      <div className="absolute left-1/2 top-16 h-4 w-10 -translate-x-1/2 rounded-b-full border-b-4 border-slate-900" />
      <div className="absolute left-6 top-2 h-8 w-20 -rotate-6 rounded-lg border-4 border-slate-900 bg-blue-500" />
      <div className="absolute left-8 top-4 h-3 w-16 rounded-full bg-white/45" />
      <div className="absolute bottom-2 left-2 h-10 w-6 -rotate-12 rounded-full border-4 border-slate-900 bg-yellow-300" />
      <div className="absolute bottom-2 right-2 h-10 w-6 rotate-12 rounded-full border-4 border-slate-900 bg-yellow-300" />
      <div className="absolute -right-1 top-20 h-4 w-10 rotate-[-30deg] rounded-full border-4 border-slate-900 bg-slate-100" />
    </div>
  );
}
