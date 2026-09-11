"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useProfile } from "@/lib/hooks";
import type { Business, Profile } from "@/lib/types";

export default function AdminDashboard() {
  const { profile } = useProfile();
  const [pending, setPending] = useState<Business[]>([]);
  const [all, setAll] = useState<Business[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [ownerCount, setOwnerCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("businesses")
      .select("*")
      .eq("status", "pending")
      .order("created_at")
      .then(({ data }) => setPending((data as Business[]) ?? []));
    supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setAll((data as Business[]) ?? []));
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "user")
      .then(({ count }) => setOwnerCount(count ?? 0));
    supabase
      .from("profiles")
      .select("*")
      .in("role", ["manager"])
      .then(({ data }) => setManagers((data as Profile[]) ?? []));
  }, []);

  const activeShops = all.filter((b) => b.status === "approved").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">
          Welcome, {profile?.role === "owner" ? "Yasir" : (profile?.full_name || "Team")} 👋
        </h1>
        <p className="text-sm text-gray-600">Approvals and support — all in one place. Shop revenue stays private; we never track it.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending requests" value={pending.length} href="/admin/businesses?status=pending" highlight={pending.length > 0} />
        <StatCard label="Active shops" value={activeShops} href="/admin/businesses" />
        <StatCard label="Shop owners" value={ownerCount ?? "…"} href="/admin/owners" />
        <StatCard label="Managers" value={managers.length} href="/admin/team" />
      </div>

      {pending.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-bold">🕒 Pending approval requests</h2>
          <div className="space-y-2">
            {pending.slice(0, 5).map((b) => (
              <Link key={b.id} href="/admin/businesses?status=pending" className="flex items-center justify-between rounded-xl border border-gray-200 p-3 text-sm hover:bg-gray-50">
                <span>
                  <b>{b.name}</b>
                  <span className="block text-xs text-gray-500">{b.business_type} · by {b.owner_name}</span>
                </span>
                <span className="font-bold text-[#0ea75f]">Review →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 font-bold">🏪 Latest shops</h2>
        <div className="space-y-2 text-sm">
          {all.slice(0, 5).map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
              <span>
                <b>{b.name}</b>
                <span className="block text-xs text-gray-500">{b.owner_name} · {b.owner_phone}</span>
              </span>
              <span className="chip">{b.status}</span>
            </div>
          ))}
          {all.length === 0 && <p className="text-gray-500">No shops have applied yet.</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href, highlight }: { label: string; value: number | string; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`card block ${highlight ? "border-[#0ea75f] ring-1 ring-[#0ea75f]" : ""}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-extrabold">{value}</div>
    </Link>
  );
}
