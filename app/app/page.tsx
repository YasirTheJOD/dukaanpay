"use client";

import Link from "next/link";
import { useBiz } from "@/lib/biz";
import { useProfile } from "@/lib/hooks";
import { Shell } from "@/components/shell";
import type { BusinessStatus } from "@/lib/types";

const STATUS_STYLE: Record<BusinessStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-gray-200 text-gray-700",
};

export default function DashboardPage() {
  const { businesses, currentId, setCurrentId, reload } = useBiz();
  const { profile } = useProfile();

  const firstName = (profile?.full_name || "Shop Owner").trim().split(/\s+/)[0];
  const approved = businesses.filter((b) => b.status === "approved");
  const pending = businesses.filter((b) => b.status === "pending");

  return (
    <Shell
      title="Dashboard"
      businesses={businesses}
      currentBusinessId={currentId}
      onBusinessChange={setCurrentId}
    >
      {/* Personal welcome — proves this is THEIR dashboard */}
      <div className="card flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0ea75f22] text-2xl">
          👤
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold">Welcome, {firstName} 👋</h2>
          <p className="truncate text-xs text-gray-500">
            {profile?.phone ? `📞 ${profile.phone} · ` : ""}
            {profile?.full_name || "Complete your profile"}
          </p>
        </div>
        <Link href="/app/profile" className="ml-auto shrink-0 text-sm font-bold text-[#0ea75f]">
          Edit profile
        </Link>
      </div>

      {/* Pending approval strip */}
      {pending.length > 0 && (
        <div className="mt-3 rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-800">
          <b>⏳ {pending.length === 1 ? pending[0].name : `${pending.length} shops`} awaiting approval</b>
          <p className="mt-1 text-xs">
            The DukaanPay team usually reviews new shops within 24 hours — you&apos;ll get a
            notification here the moment it&apos;s decided.
          </p>
        </div>
      )}

      {/* Your shops */}
      <h3 className="mt-4 mb-2 text-sm font-bold text-gray-700">🏪 Your shops ({businesses.length})</h3>
      <div className="space-y-3">
        {businesses.map((b) => {
          const active = b.id === currentId;
          return (
            <div key={b.id} className={`card ${active ? "border-[#0ea75f] ring-1 ring-[#0ea75f]" : ""}`}>
              <div className="flex items-center gap-3">
                {b.shop_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.shop_logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0ea75f22] text-2xl">🏪</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold">{b.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="truncate text-xs text-gray-500">{b.business_type} · {b.address}</div>
                </div>
              </div>
              {!active && b.status === "approved" && (
                <button className="btn-outline mt-3 !py-2 text-sm" onClick={() => setCurrentId(b.id)}>
                  Work with this shop
                </button>
              )}
            </div>
          );
        })}

        {businesses.length === 0 && (
          <div className="card space-y-2 text-center">
            <div className="text-4xl">🏪</div>
            <h3 className="text-lg font-bold">Add your first shop to start billing</h3>
            <p className="text-sm text-gray-600">
              Tell us about your shop — name, type and address. The DukaanPay team reviews every
              application, usually within 24 hours. Once approved you can add items and create bills.
            </p>
            <Link href="/app/apply" className="btn-primary mt-1 block">
              ➕ Apply for New Shop
            </Link>
          </div>
        )}

        {businesses.length > 0 && (
          <Link href="/app/apply" className="btn-outline block text-center">
            ➕ Apply for New Shop
          </Link>
        )}
      </div>

      {/* Quick actions once at least one shop is approved */}
      {approved.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-bold text-gray-700">⚡ Quick actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/app/new-bill" className="card text-center text-sm font-bold">🧾 New Bill</Link>
            <Link href="/app/inventory" className="card text-center text-sm font-bold">📦 Inventory</Link>
            <Link href="/app/history" className="card text-center text-sm font-bold">📊 History</Link>
            <Link href="/app/items/new" className="card text-center text-sm font-bold">➕ New Item</Link>
          </div>
        </>
      )}

      <button className="mt-4 text-sm font-semibold text-gray-500" onClick={async () => await reload()}>
        ↻ Refresh statuses
      </button>
    </Shell>
  );
}
