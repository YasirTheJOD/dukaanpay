"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useBiz, uploadImage } from "@/lib/biz";
import { UNITS, unitLabel, ratePerUnit } from "@/lib/units";
import { Shell } from "@/components/shell";
import type { Item, ItemCategory } from "@/lib/types";

type SortKey = "most_used" | "name" | "price_desc" | "price_asc" | "newest";

export default function InventoryPage() {
  const { businesses, currentId, setCurrentId, current } = useBiz();
  const supabase = createClient();

  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<ItemCategory[]>([]);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "product" | "service">("all");
  const [catFilter, setCatFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("most_used");
  const [editing, setEditing] = useState<Item | null>(null);
  const [newImage, setNewImage] = useState<File | null>(null);

  const load = async () => {
    if (!currentId) return;
    const [i, c] = await Promise.all([
      supabase.from("items").select("*").eq("business_id", currentId),
      supabase.from("item_categories").select("*").eq("business_id", currentId).order("name"),
    ]);
    setItems((i.data as Item[]) ?? []);
    setCats((c.data as ItemCategory[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? null;

  const shown = useMemo(() => {
    let list = [...items];
    if (q.trim()) list = list.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (kindFilter !== "all") list = list.filter((i) => i.kind === kindFilter);
    if (catFilter !== "all") list = list.filter((i) => i.category_id === catFilter);
    switch (sort) {
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "newest":
        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        break;
      default:
        list.sort((a, b) => b.use_count - a.use_count);
    }
    return list;
  }, [items, q, kindFilter, catFilter, sort]);

  const saveEdit = async () => {
    if (!editing) return;
    let image_url = editing.image_url;
    if (newImage) image_url = await uploadImage(newImage, "items");
    const { error } = await supabase
      .from("items")
      .update({
        name: editing.name,
        kind: editing.kind,
        price: editing.price,
        base_qty: editing.base_qty,
        base_unit: editing.base_unit,
        category_id: editing.category_id,
        image_url,
      })
      .eq("id", editing.id);
    if (error) alert(error.message);
    setEditing(null);
    setNewImage(null);
    load();
  };

  const removeItem = async (id: string) => {
    if (!confirm("Delete this item? Past bills keep their record.")) return;
    await supabase.from("items").delete().eq("id", id);
    load();
  };

  const locked = !current || current.status !== "approved";

  return (
    <Shell title="Inventory" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>
      {locked ? (
        <div className="card text-center text-sm text-gray-600">Select an approved shop first (top bar).</div>
      ) : (
        <>
          <input className="input mb-2" placeholder="🔍 Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <select className="chip" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "all" | "product" | "service")}>
              <option value="all">All types</option>
              <option value="product">Products</option>
              <option value="service">Services</option>
            </select>
            <select className="chip" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className="chip" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="most_used">Most used</option>
              <option value="name">Name A–Z</option>
              <option value="price_desc">Price high → low</option>
              <option value="price_asc">Price low → high</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div className="space-y-2">
            {shown.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No items found. Add one from the menu ☰ → Create New Item.</p>}
            {shown.map((it) => (
              <div key={it.id} className="card flex items-center gap-3 !py-3">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">{it.kind === "service" ? "🛠️" : "📦"}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{it.name}</div>
                  <div className="text-xs text-gray-500">
                    ₹{it.price} / {it.base_qty} {unitLabel(it.base_unit)} · {it.base_qty > 1 ? `₹${ratePerUnit(it.base_qty, it.base_unit, it.price, it.base_unit).toFixed(2)} per 1 ${unitLabel(it.base_unit)}` : ""}
                    {catName(it.category_id) ? ` · ${catName(it.category_id)}` : ""}
                  </div>
                </div>
                <button className="chip" onClick={() => setEditing({ ...it })}>
                  Edit
                </button>
                <button className="text-sm font-bold text-red-500" onClick={() => removeItem(it.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {editing && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setEditing(null)}>
              <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold">Edit item</h2>
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Type</label>
                    <select className="input" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as "product" | "service" })}>
                      <option value="product">Product</option>
                      <option value="service">Service</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Price (₹)</label>
                    <input className="input" type="number" min="0" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Pack size</label>
                    <input className="input" type="number" min="0.01" step="any" value={editing.base_qty} onChange={(e) => setEditing({ ...editing, base_qty: parseFloat(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <select className="input" value={editing.base_unit} onChange={(e) => setEditing({ ...editing, base_unit: e.target.value })}>
                      {UNITS.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}>
                    <option value="">— none —</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Replace picture</label>
                  <input className="input" type="file" accept="image/*" onChange={(e) => setNewImage(e.target.files?.[0] ?? null)} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="btn-outline" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={saveEdit}>
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
