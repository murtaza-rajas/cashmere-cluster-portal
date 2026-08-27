import SessionStatus from "./session-status";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 px-6 font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Cashmere Lovers Club</h1>
        <p className="text-sm text-zinc-500">Member portal — Phase 1</p>
      </div>
      <SessionStatus />
    </div>
  );
}
