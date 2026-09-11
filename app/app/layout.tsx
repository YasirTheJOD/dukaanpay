"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BusinessProvider, useBiz } from "@/lib/biz";
import { Shell } from "@/components/shell";

function Inner({ children }: { children: React.ReactNode }) {
  const { businesses, currentId, setCurrentId, loading } = useBiz();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>
    );
  }

  // Pages that work even with zero businesses
  const passthrough = ["/app/apply", "/app/privacy", "/app/terms", "/app/notifications"];
  if (passthrough.includes(pathname)) {
    return <Shell businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>{children}</Shell>;
  }

  if (businesses.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <div className="card text-center">
          <div className="mb-2 text-4xl">🏪</div>
          <h1 className="text-lg font-bold">My Businesses</h1>
          <p className="mt-2 text-sm text-gray-600">
            You haven&apos;t added a shop yet. Apply with your shop details — approvals usually
            happen within 24 hours, and you&apos;ll get a notification right here.
          </p>
          <Link href="/app/apply" className="btn-primary mt-4 block">
            ➕ Apply for New Shop
          </Link>
          <Link href="/app/notifications" className="mt-3 block text-sm font-semibold text-[#0ea75f]">
            View notifications
          </Link>
        </div>
      </main>
    );
  }

  return (
    <Shell businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>
      {children}
    </Shell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessProvider>
      <Inner>{children}</Inner>
    </BusinessProvider>
  );
}
