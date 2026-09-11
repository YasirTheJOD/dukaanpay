"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, useProfile, useNotifications } from "@/lib/hooks";
import { createClient } from "@/lib/supabase";
import type { Business } from "@/lib/types";

export function DrawerMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-72 max-w-[85vw] bg-white shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="bg-[#0ea75f] p-4 text-white">
          <div className="text-lg font-bold">DukaanPay</div>
          <div className="text-xs opacity-80">Bills for every business</div>
        </div>
        <nav className="flex flex-col p-3 text-sm font-semibold text-gray-800">
          <DrawerLink href="/app/items/new" label="➕ Create New Item" onClick={onClose} />
          <DrawerLink href="/app/categories/new" label="🗂️ Add Category" onClick={onClose} />
          <DrawerLink href="/app/inventory" label="📦 Inventory" onClick={onClose} />
          <DrawerLink href="/app/profile" label="👤 Profile" onClick={onClose} />
          <DrawerLink href="/app/privacy" label="🔒 Privacy Policy" onClick={onClose} />
          <DrawerLink href="/app/terms" label="📜 Terms & Conditions" onClick={onClose} />
          <DrawerLink href="/app/support" label="💬 Support" onClick={onClose} />
        </nav>
        <SignOutButton />
      </div>
    </>
  );
}

function DrawerLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="rounded-xl px-3 py-3 hover:bg-gray-100 active:bg-gray-200">
      {label}
    </Link>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <div className="absolute bottom-4 left-0 w-full px-3">
      <button
        className="btn-outline"
        onClick={async () => {
          await createClient().auth.signOut();
          router.push("/login");
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

export function NotificationsBell() {
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button aria-label="Notifications" className="relative text-xl" onClick={() => { setOpen(!open); if (!open) markAllRead(); }}>
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
          <div className="absolute right-0 z-40 mt-2 max-h-96 w-80 max-w-[90vw] overflow-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
            {items.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No notifications yet</div>}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/app"}
                onClick={() => setOpen(false)}
                className="block rounded-xl p-3 hover:bg-gray-50"
              >
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-xs text-gray-600">{n.body}</div>
                <div className="mt-1 text-[10px] text-gray-400">{new Date(n.created_at).toLocaleString("en-IN")}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BusinessSwitcher({ businesses, currentId, onChange }: { businesses: Business[]; currentId: string | null; onChange: (id: string) => void }) {
  const current = businesses.find((b) => b.id === currentId);
  return (
    <select
      className="max-w-[45vw] truncate rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold"
      value={currentId ?? ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Select business"
    >
      {businesses.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name} {b.status !== "approved" ? `(${b.status})` : ""}
        </option>
      ))}
      {!current && <option value="">No business</option>}
    </select>
  );
}

export function TopBar({
  onMenu,
  title,
  children,
}: {
  onMenu: () => void;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <button aria-label="Menu" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-lg" onClick={onMenu}>
        ☰
      </button>
      {title ? <div className="truncate text-base font-bold">{title}</div> : null}
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  );
}

export function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 z-20 flex w-full border-t border-gray-200 bg-white">
      <Link href="/app/new-bill" className="flex-1 py-3 text-center text-sm font-bold text-[#0ea75f]">
        🧾 New Bill
      </Link>
      <Link href="/app/history" className="flex-1 border-l border-gray-200 py-3 text-center text-sm font-bold text-gray-700">
        📊 History
      </Link>
    </div>
  );
}

export function Shell({
  title,
  businesses,
  currentBusinessId,
  onBusinessChange,
  children,
  hideNav,
}: {
  title?: string;
  businesses: Business[];
  currentBusinessId: string | null;
  onBusinessChange: (id: string) => void;
  children: React.ReactNode;
  hideNav?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-16">
      <TopBar onMenu={() => setMenuOpen(true)} title={title}>
        {businesses.length > 0 && (
          <BusinessSwitcher businesses={businesses} currentId={currentBusinessId} onChange={onBusinessChange} />
        )}
        <NotificationsBell />
      </TopBar>
      <DrawerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="p-4">{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
