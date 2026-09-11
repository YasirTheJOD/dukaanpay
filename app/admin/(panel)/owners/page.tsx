"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Business, BusinessStatus } from "@/lib/types";

const STYLE: Record<BusinessStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-gray-200 text-gray-700",
};

interface OwnerAccount {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
  shops: number;
}

/**
 * Owners page — every shop-owner account (role 'user') in one list.
 * These accounts never hold a team role; team members live on the Team page.
 */
export default function AdminOwnersPage() {
  const [owners, setOwners] = useState<OwnerAccount[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ownersRes, bizRes] = await Promise.all([
      fetch("/api/admin/owners"),
      fetch("/api/admin/shops"),
    ]);
    if (ownersRes.ok) {
      const json = await ownersRes.json();
      setOwners(json.owners ?? []);
    } else {
      const json = await ownersRes.json().catch(() => null);
      setError(json?.error ?? "Could not load owner accounts.");
    }
    if (bizRes.ok) {
      const json = await bizRes.json();
      setBusinesses(json.businesses ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    if (!q.trim()) return owners;
    const s = q.trim().toLowerCase();
    return owners.filter(
      (o) => o.full_name.toLowerCase().includes(s) || o.phone.includes(s)
    );
  }, [owners, q]);

  const shopsOf = (ownerId: string) => businesses.filter((b) => b.owner_id === ownerId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-extrabold">Shop Owners</h1>
        <input
          className="input ml-auto !w-56"
          placeholder="Search name / phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card bg-amber-50 text-sm">
        Every signup is a <b>shop-owner account</b> with no team role. They apply for shops, bill
        customers, and can be approved on the <b>Shops</b> page. Team access is granted only from the
        <b> Team</b> page by the Lead Owner.
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-2">
          {shown.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              {q ? "No owners match." : "No shop-owner accounts yet."}
            </p>
          )}
          {shown.map((o) => {
            const shops = shopsOf(o.id);
            return (
              <div key={o.id} className="card">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{o.full_name || "(no name)"}</div>
                    <div className="text-xs text-gray-500">
                      📞 {o.phone || "—"} · joined {new Date(o.created_at).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <span className="chip">
                    {shops.length} shop{shops.length === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                    shop owner
                  </span>
                </div>
                {shops.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                    {shops.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-xs">
                        <span className="font-semibold">🏪 {b.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STYLE[b.status]}`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
