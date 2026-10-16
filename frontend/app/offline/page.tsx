
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">
        You're offline
      </h1>

      <p className="max-w-sm text-muted-foreground">
        SpendLog needs an internet connection to load your expenses.
        Please reconnect and try again.
      </p>

      <a
        href="/"
        className="rounded-lg bg-primary px-5 py-2 text-primary-foreground"
      >
        Try again
      </a>
    </main>
  );
}
