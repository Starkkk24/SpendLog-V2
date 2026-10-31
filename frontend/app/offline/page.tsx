import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-sp-bg px-6 pt-safe pb-safe text-center">
      <div className="grid size-16 animate-pop-in place-items-center rounded-full bg-sp-card text-sp-muted">
        <WifiOff size={28} />
      </div>

      <h1 className="text-2xl font-semibold text-sp-text">
        You&apos;re offline
      </h1>

      <p className="max-w-sm text-sp-muted">
        SpendLog needs an internet connection to load your expenses.
        Please reconnect and try again.
      </p>

      <a
        href="/"
        className="mt-2 inline-flex h-11 items-center rounded-sp-md bg-sp-primary px-5 font-medium text-white shadow-sp-card transition active:scale-[0.97]"
      >
        Try again
      </a>
    </main>
  );
}
