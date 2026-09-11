"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="card space-y-3 text-center">
        <div className="text-4xl">😕</div>
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="text-sm text-gray-600">
          The page hit an unexpected error. Your data is safe — please try again.
        </p>
        {error?.message && (
          <p className="rounded-xl bg-gray-50 p-3 text-left text-xs text-gray-500">{error.message}</p>
        )}
        <button className="btn-primary" onClick={reset}>
          ↻ Try again
        </button>
        <a href="/app" className="btn-outline block">
          🏪 Back to My Businesses
        </a>
      </div>
    </main>
  );
}
