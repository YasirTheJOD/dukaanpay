"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useProfile, useNotifications } from "@/lib/hooks";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/businesses", label: "Shops" },
  { href: "/admin/owners", label: "Owners" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/team", label: "Team" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, profileLoading } = useProfile();
  const pathname = usePathname();

  if (profileLoading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>;
  }

  if (!profile || (profile.role !== "owner" && profile.role !== "manager" && profile.role !== "staff")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <div className="card text-center">
          <div className="mb-2 text-4xl">⛔</div>
          <h1 className="text-lg font-bold">Not authorized</h1>
          <p className="mt-2 text-sm text-gray-600">This area is only for the DukaanPay team.</p>
          <button
            className="btn-outline mt-4"
            onClick={async () => {
              await createClient().auth.signOut();
              window.location.href = "/login";
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <span className="text-lg font-extrabold">
            Dukaan<span className="text-[#0ea75f]">Pay</span>{" "}
            <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Team</span>
          </span>
          <nav className="ml-auto flex items-center gap-1 text-sm font-semibold">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-xl px-3 py-2 ${
                  pathname === n.href ? "bg-[#0ea75f] text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <AdminBell />
          <button
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold"
            onClick={async () => {
              await createClient().auth.signOut();
              window.location.href = "/admin/login";
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
      <footer className="pb-6 text-center text-xs text-gray-400">
        Signed in as {profile.role} · DukaanPay Admin
      </footer>
    </div>
  );
}

function AdminBell() {
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="relative text-xl"
        onClick={() => {
          setOpen(!open);
          if (!open) markAllRead();
        }}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 max-h-96 w-80 overflow-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
            {items.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No notifications</div>}
            {items.map((n) => (
              <Link key={n.id} href={n.link ?? "/admin"} onClick={() => setOpen(false)} className="block rounded-xl p-3 hover:bg-gray-50">
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-xs text-gray-600">{n.body}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
