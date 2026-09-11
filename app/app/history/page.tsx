"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useBiz } from "@/lib/biz";
import { billTotal, invoiceHTML } from "@/lib/invoice";
import { shareInvoice } from "@/lib/share";
import { Shell } from "@/components/shell";
import type { Bill } from "@/lib/types";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function HistoryPage() {
  const { businesses, currentId, setCurrentId, current } = useBiz();
  const supabase = createClient();

  const [bills, setBills] = useState<Bill[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [resend, setResend] = useState<Bill | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!currentId) return;
    let query = supabase.from("bills").select("*").eq("business_id", currentId);
    if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
    if (to) query = query.lte("created_at", `${to}T23:59:59Z`);
    const { data } = await query.order("created_at", { ascending: false }).limit(500);
    setBills((data as Bill[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, from, to]);

  const filtered = useMemo(() => {
    if (!q.trim()) return bills;
    const s = q.trim().toLowerCase();
    return bills.filter(
      (b) =>
        b.order_id.toLowerCase().includes(s) ||
        (b.customer_name ?? "").toLowerCase().includes(s) ||
        (b.customer_phone ?? "").includes(s) ||
        (b.customer_email ?? "").toLowerCase().includes(s)
    );
  }, [bills, q]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const thisMonth = new Date().toISOString().slice(0, 7);
    let todayTotal = 0;
    let monthTotal = 0;
    let allTotal = 0;
    let monthCount = 0;
    for (const b of bills) {
      const t = billTotal(b);
      allTotal += t;
      if (new Date(b.created_at).toDateString() === today) todayTotal += t;
      if (b.created_at.slice(0, 7) === thisMonth) {
        monthTotal += t;
        monthCount += 1;
      }
    }
    return { todayTotal, monthTotal, allTotal, monthCount, avg: monthCount ? monthTotal / monthCount : 0 };
  }, [bills]);

  return (
    <Shell title="History & Stats" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>
      {!current ? (
        <div className="card text-center text-sm text-gray-600">Select a shop first (top bar).</div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="card !py-3">
              <div className="text-[10px] font-bold uppercase text-gray-500">Today</div>
              <div className="text-lg font-bold">₹{stats.todayTotal.toFixed(0)}</div>
            </div>
            <div className="card !py-3">
              <div className="text-[10px] font-bold uppercase text-gray-500">This month</div>
              <div className="text-lg font-bold">₹{stats.monthTotal.toFixed(0)}</div>
            </div>
            <div className="card !py-3">
              <div className="text-[10px] font-bold uppercase text-gray-500">All time</div>
              <div className="text-lg font-bold">₹{stats.allTotal.toFixed(0)}</div>
            </div>
            <div className="card !py-3">
              <div className="text-[10px] font-bold uppercase text-gray-500">Avg bill (month)</div>
              <div className="text-lg font-bold">₹{stats.avg.toFixed(0)}</div>
            </div>
          </div>

          <div className="card mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">From date</label>
                <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">To date</label>
                <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <input className="input" placeholder="🔍 Search Order ID, name, number, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No bills found.</p>}
            {filtered.map((b) => (
              <div key={b.id} className="card !py-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-bold">
                      #{b.order_id} <span className="font-normal text-gray-500">· {b.customer_name || "Walk-in"}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(b.created_at).toLocaleString("en-IN")} · {b.items.length} items
                      {b.labor_charge > 0 ? " · labor" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">₹{billTotal(b).toFixed(0)}</div>
                    <button className="text-xs font-bold text-[#0ea75f]" onClick={() => setResend(b)}>
                      Resend ↻
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {resend && (
            <>
              <div ref={invoiceRef} className="fixed -left-[9999px] top-0" dangerouslySetInnerHTML={{ __html: invoiceHTML(resend, current) }} />
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setResend(null)}>
                <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-lg font-bold">Resend bill #{resend.order_id}</h2>
                  <p className="text-sm text-gray-600">Share the invoice image again — WhatsApp, or any app on your phone.</p>
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      if (invoiceRef.current) await shareInvoice(invoiceRef.current, resend, resend.customer_name);
                    }}
                  >
                    📤 Share / Download Invoice
                  </button>
                  <button className="btn-outline" onClick={() => setResend(null)}>
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
