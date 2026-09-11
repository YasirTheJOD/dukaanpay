"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useBiz } from "@/lib/biz";
import { UNITS, unitLabel, unitByCode, convertibleUnits, ratePerUnit } from "@/lib/units";
import { generateOrderId, invoiceHTML, billTotal } from "@/lib/invoice";
import { shareInvoice, openWhatsApp } from "@/lib/share";
import { Shell } from "@/components/shell";
import type { Bill, BillLine, Item } from "@/lib/types";

interface CartLine extends BillLine {
  item: Item;
}

export default function NewBillPage() {
  const { businesses, currentId, setCurrentId, current } = useBiz();
  const supabase = createClient();

  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [labor, setLabor] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Bill | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentId || current?.status !== "approved") return;
    supabase.from("items").select("*").eq("business_id", currentId).then(({ data }) => setItems((data as Item[]) ?? []));
  }, [currentId, current, supabase]);

  const mostUsed = useMemo(
    () => [...items].sort((a, b) => b.use_count - a.use_count).slice(0, 8),
    [items]
  );
  const searchResults = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.trim().toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(s)).slice(0, 12);
  }, [items, q]);

  const addItem = (item: Item) => {
    setCart((c) => {
      const idx = c.findIndex((l) => l.item.id === item.id);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + item.base_qty };
        copy[idx] = { ...copy[idx], amount: round2(copy[idx].qty * copy[idx].rate) };
        return copy;
      }
      return [
        ...c,
        {
          item,
          item_id: item.id,
          name: item.name,
          qty: item.base_qty,
          unit: item.base_unit,
          rate: ratePerUnit(item.base_qty, item.base_unit, item.price, item.base_unit),
          amount: round2(item.price),
        },
      ];
    });
  };

  const setLineQty = (idx: number, qty: number) => {
    setCart((c) =>
      c.map((l, i) => (i === idx ? { ...l, qty, amount: round2(qty * l.rate) } : l))
    );
  };

  const setLineUnit = (idx: number, unit: string) => {
    setCart((c) =>
      c.map((l, i) => {
        if (i !== idx) return l;
        // keep the physical quantity constant when switching kg<->g etc.
        const from = unitByCode(l.unit);
        const to = unitByCode(unit);
        let newQty = l.qty;
        if (from && to && from.factor !== null && to.factor !== null) {
          newQty = (l.qty * from.factor) / to.factor;
        }
        const rate = ratePerUnit(l.item.base_qty, l.item.base_unit, l.item.price, unit);
        return { ...l, unit, qty: newQty, rate, amount: round2(newQty * rate) };
      })
    );
  };

  const removeLine = (idx: number) => setCart((c) => c.filter((_, i) => i !== idx));

  const itemsTotal = cart.reduce((s, l) => s + l.amount, 0);
  const laborNum = parseFloat(labor) || 0;
  const total = itemsTotal + laborNum;

  const send = async () => {
    if (!current || cart.length === 0) return;
    setBusy(true);
    try {
      const bill: Bill = {
        id: crypto.randomUUID(),
        business_id: currentId!,
        order_id: generateOrderId(),
        customer_name: custName || null,
        customer_phone: custPhone || null,
        customer_email: custEmail || null,
        items: cart.map(({ item_id, name, qty, unit, rate, amount }) => ({ item_id, name, qty, unit, rate, amount })),
        labor_charge: laborNum,
        total_amount: round2(total),
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("bills").insert({
        business_id: bill.business_id,
        order_id: bill.order_id,
        customer_name: bill.customer_name,
        customer_phone: bill.customer_phone,
        customer_email: bill.customer_email,
        items: bill.items,
        labor_charge: bill.labor_charge,
        total_amount: bill.total_amount,
      });
      if (error) throw error;

      // bump most-used counters
      cart.forEach((l) => {
        supabase
          .from("items")
          .update({ use_count: l.item.use_count + 1 })
          .eq("id", l.item.id)
          .then(() => {});
      });

      setDone(bill);
      setCheckout(false);
      // let the invoice node render before sharing
      setTimeout(async () => {
        if (invoiceRef.current) {
          try {
            await shareInvoice(invoiceRef.current, bill, bill.customer_name);
          } catch {}
        }
      }, 300);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const locked = !current || current.status !== "approved";

  if (done) {
    return (
      <Shell title="Bill Sent ✅" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>
        <div className="card space-y-3 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="text-lg font-bold">Order {done.order_id}</h2>
          <p className="text-sm text-gray-600">
            Total ₹{billTotal(done).toFixed(2)} — saved in History. The invoice image was prepared for
            sharing; if the share sheet didn&apos;t open, use the buttons below.
          </p>
          {/* Rendered off-screen, NOT display:none — html2canvas cannot capture hidden elements */}
          <div ref={invoiceRef} className="fixed -left-[9999px] top-0" dangerouslySetInnerHTML={{ __html: invoiceHTML(done, current!) }} />
          <button className="btn-primary" onClick={() => invoiceRef.current && shareInvoice(invoiceRef.current, done, done.customer_name)}>
            📤 Share / Download Invoice Again
          </button>
          {done.customer_phone && (
            <button className="btn-outline" onClick={() => openWhatsApp(done.customer_phone, done)}>
              💬 Open WhatsApp Chat
            </button>
          )}
          <Link href="/app/history" className="btn-outline block">
            📊 Go to History
          </Link>
          <button
            className="text-sm font-semibold text-[#0ea75f]"
            onClick={() => {
              setDone(null);
              setCart([]);
              setLabor("");
              setCustName("");
              setCustPhone("");
              setCustEmail("");
            }}
          >
            ➕ Start next bill
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Create New Bill" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>
      {locked ? (
        <div className="card text-center text-sm text-gray-600">Select an approved shop first (top bar).</div>
      ) : (
        <>
          <input className="input mb-3" placeholder="🔍 Search product or service…" value={q} onChange={(e) => setQ(e.target.value)} />

          {q.trim() === "" && (
            <>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Most used</h3>
              <div className="mb-4 flex flex-wrap gap-2">
                {mostUsed.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No items yet — add from menu ☰ → Create New Item.
                  </p>
                )}
                {mostUsed.map((it) => (
                  <button key={it.id} className="chip" onClick={() => addItem(it)}>
                    {it.kind === "service" ? "🛠️" : "📦"} {it.name} · ₹{it.price}
                  </button>
                ))}
              </div>
            </>
          )}

          {searchResults.length > 0 && (
            <div className="mb-4 space-y-2">
              {searchResults.map((it) => (
                <button key={it.id} className="card flex w-full items-center justify-between !py-3 text-left" onClick={() => { addItem(it); setQ(""); }}>
                  <span>
                    <span className="text-sm font-bold">{it.name}</span>
                    <span className="block text-xs text-gray-500">
                      ₹{it.price} / {it.base_qty} {unitLabel(it.base_unit)}
                    </span>
                  </span>
                  <span className="font-bold text-[#0ea75f]">+ Add</span>
                </button>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Bill items</h3>
              {cart.map((l, idx) => (
                <div key={`${l.item.id}-${idx}`} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{l.name}</span>
                    <button className="text-sm font-bold text-red-500" onClick={() => removeLine(idx)}>
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input !w-24 text-center"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={l.qty}
                      onChange={(e) => setLineQty(idx, parseFloat(e.target.value) || 0)}
                    />
                    <select className="input !w-28" value={l.unit} onChange={(e) => setLineUnit(idx, e.target.value)}>
                      {convertibleUnits(l.item.base_unit).map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto text-right">
                      <div className="text-[10px] text-gray-500">₹{l.rate.toFixed(2)}/{unitLabel(l.unit)}</div>
                      <div className="font-bold">₹{l.amount.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="card space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label !mb-0">🛠️ Labor / service charge (editable)</label>
                  <input
                    className="input !w-28 text-right"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                    value={labor}
                    onChange={(e) => setLabor(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                  <span>Items total</span>
                  <span className="font-semibold">₹{itemsTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>

              <button className="btn-primary" onClick={() => setCheckout(true)}>
                ✅ Checkout — ₹{total.toFixed(2)}
              </button>
            </div>
          )}

          {checkout && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setCheckout(false)}>
              <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold">Customer details</h2>
                <div>
                  <label className="label">Name (optional)</label>
                  <input className="input" value={custName} onChange={(e) => setCustName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Number — for WhatsApp bill (optional)</label>
                  <input className="input" type="tel" inputMode="numeric" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="10-digit mobile" />
                </div>
                <div>
                  <label className="label">Email (optional)</label>
                  <input className="input" type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
                </div>
                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  <div className="flex justify-between"><span>Items</span><span>₹{itemsTotal.toFixed(2)}</span></div>
                  {laborNum > 0 && <div className="flex justify-between"><span>Labor</span><span>₹{laborNum.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                </div>
                <button className="btn-primary" disabled={busy || cart.length === 0} onClick={send}>
                  {busy ? "Sending…" : "📤 Send Bill"}
                </button>
                <button className="btn-outline" onClick={() => setCheckout(false)}>
                  Back
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
