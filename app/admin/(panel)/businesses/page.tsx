"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Business, BusinessStatus } from "@/lib/types";

const STATUSES: BusinessStatus[] = ["pending", "approved", "rejected", "suspended"];

const STYLE: Record<BusinessStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-gray-200 text-gray-700",
};

export default function AdminBusinessesPage() {
  const supabase = createClient();
  const params = useSearchParams();
  const [list, setList] = useState<Business[]>([]);
  const [filter, setFilter] = useState<BusinessStatus | "all">((params.get("status") as BusinessStatus) ?? "all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Business | null>(null);

  const load = async () => {
    const { data } = await supabase.from("businesses").select("*").order("created_at", { ascending: false });
    setList((data as Business[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    let l = [...list];
    if (filter !== "all") l = l.filter((b) => b.status === filter);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      l = l.filter(
        (b) =>
          b.name.toLowerCase().includes(s) ||
          b.owner_name.toLowerCase().includes(s) ||
          b.owner_phone.includes(s) ||
          b.owner_email.toLowerCase().includes(s)
      );
    }
    return l;
  }, [list, filter, q]);

  const setStatus = async (b: Business, status: BusinessStatus) => {
    await supabase.from("businesses").update({ status }).eq("id", b.id);
    setDetail(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-extrabold">Shops</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <input className="input !w-56" placeholder="Search shop / owner / phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input !w-40" value={filter} onChange={(e) => setFilter(e.target.value as BusinessStatus | "all")}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {shown.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No shops match.</p>}
        {shown.map((b) => (
          <div key={b.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{b.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STYLE[b.status]}`}>{b.status}</span>
              </div>
              <div className="text-xs text-gray-500">
                {b.business_type} · Owner: {b.owner_name} · 📞 {b.owner_phone} · ✉️ {b.owner_email}
              </div>
              <div className="text-xs text-gray-400">Applied {new Date(b.created_at).toLocaleDateString("en-IN")}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.status !== "approved" && (
                <button className="rounded-xl bg-[#0ea75f] px-3 py-2 text-sm font-bold text-white" onClick={() => setStatus(b, "approved")}>
                  Approve
                </button>
              )}
              {b.status === "pending" && (
                <button className="rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white" onClick={() => setStatus(b, "rejected")}>
                  Reject
                </button>
              )}
              {b.status === "approved" && (
                <button className="rounded-xl bg-gray-600 px-3 py-2 text-sm font-bold text-white" onClick={() => setStatus(b, "suspended")}>
                  Suspend
                </button>
              )}
              <button className="chip" onClick={() => setDetail(b)}>
                Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">{detail.name}</h2>
            <span className={`chip ${detail.status === "approved" ? "!border-green-300 !bg-green-50" : ""}`}>{detail.status}</span>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Business type" value={detail.business_type} />
              <Info label="Work type / services" value={detail.work_type} />
              <Info label="Shop phone" value={detail.shop_phone} />
              <Info label="Shop email" value={detail.shop_email} />
              <Info label="Address" value={detail.address} />
              <Info label="Owner name" value={detail.owner_name} />
              <Info label="Owner phone" value={detail.owner_phone} />
              <Info label="Owner email" value={detail.owner_email} />
              <Info label="Applied on" value={new Date(detail.created_at).toLocaleString("en-IN")} />
            </div>
            <div className="flex gap-3">
              {detail.shop_logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.shop_logo_url} alt="shop" className="h-20 w-20 rounded-xl object-cover" />
              )}
              {detail.owner_photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.owner_photo_url} alt="owner" className="h-20 w-20 rounded-xl object-cover" />
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {detail.status !== "approved" && (
                <button className="btn-primary" onClick={() => setStatus(detail, "approved")}>
                  ✅ Approve
                </button>
              )}
              {detail.status === "pending" && (
                <button className="btn-outline !border-red-300 !text-red-600" onClick={() => setStatus(detail, "rejected")}>
                  ❌ Reject
                </button>
              )}
              {detail.status === "approved" && (
                <button className="btn-outline" onClick={() => setStatus(detail, "suspended")}>
                  ⏸ Suspend
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-2">
      <div className="text-[10px] font-bold uppercase text-gray-400">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}
