"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useBiz, uploadImage } from "@/lib/biz";
import { PACK_PRESETS } from "@/lib/constants";
import { UNITS, unitLabel } from "@/lib/units";
import { Shell } from "@/components/shell";
import type { ItemCategory } from "@/lib/types";

export default function NewItemPage() {
  const { businesses, currentId, setCurrentId, current } = useBiz();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"product" | "service">("product");
  const [price, setPrice] = useState("");
  const [preset, setPreset] = useState(PACK_PRESETS[0].label);
  const [customQty, setCustomQty] = useState("1");
  const [customUnit, setCustomUnit] = useState("piece");
  const [useCustom, setUseCustom] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [cats, setCats] = useState<ItemCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!currentId) return;
    supabase.from("item_categories").select("*").eq("business_id", currentId).order("name").then(({ data }) => setCats((data as ItemCategory[]) ?? []));
  }, [currentId, supabase]);

  const chosen = PACK_PRESETS.find((p) => p.label === preset);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || current.status !== "approved") return;
    setBusy(true);
    setSaved(null);
    try {
      const p = parseFloat(price);
      if (!name.trim() || isNaN(p) || p < 0) throw new Error("Enter a valid name and price");
      const base_qty = useCustom ? parseFloat(customQty) || 1 : chosen?.qty ?? 1;
      const base_unit = useCustom ? customUnit : chosen?.unit ?? "piece";
      const image_url = imageFile ? await uploadImage(imageFile, "items") : null;
      const { error } = await supabase.from("items").insert({
        business_id: currentId,
        name: name.trim(),
        kind,
        base_qty,
        base_unit,
        price: p,
        category_id: categoryId || null,
        image_url,
      });
      if (error) throw error;
      setSaved(`✅ "${name.trim()}" saved to inventory`);
      setName("");
      setPrice("");
      setImageFile(null);
      setCategoryId("");
    } catch (err) {
      setSaved(`⚠️ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const locked = !current || current.status !== "approved";

  return (
    <Shell title="Create New Item" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>
      {locked ? (
        <div className="card text-center text-sm text-gray-600">
          Select an approved shop first (top bar) or{" "}
          <Link href="/app/apply" className="font-semibold text-[#0ea75f]">
            apply for a shop
          </Link>
          .
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["product", "service"] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-bold capitalize ${
                  kind === k ? "border-[#0ea75f] bg-[#0ea75f] text-white" : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                {k === "product" ? "📦 Product" : "🛠️ Service"}
              </button>
            ))}
          </div>

          <div className="card space-y-3">
            <div>
              <label className="label">{kind === "product" ? "Product" : "Service"} name *</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "product" ? "e.g. Basmati Rice" : "e.g. Screen replacement"} />
            </div>

            <div>
              <label className="label">Price per unit (₹) *</label>
              <input className="input" required type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 100" />
            </div>

            <div>
              <label className="label">Unit / pack</label>
              {!useCustom ? (
                <select className="input" value={preset} onChange={(e) => setPreset(e.target.value)}>
                  {PACK_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-2">
                  <input className="input" type="number" min="0.01" step="any" value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
                  <select className="input" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}>
                    {UNITS.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button type="button" className="mt-1 text-xs font-semibold text-[#0ea75f]" onClick={() => setUseCustom(!useCustom)}>
                {useCustom ? "← use common packs" : "+ custom quantity & unit"}
              </button>
              <p className="mt-1 text-[11px] text-gray-500">
                Price means: ₹{price || "0"} per {useCustom ? `${customQty || 1} ${unitLabel(customUnit)}` : preset}. Customers can still buy 700g etc. — DukaanPay auto-calculates.
              </p>
            </div>

            <div>
              <label className="label">Category (optional)</label>
              <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— none —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Picture (optional)</label>
              <input className="input" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {saved && <p className="rounded-xl bg-[#0ea75f14] p-3 text-sm font-semibold text-[#067a45]">{saved}</p>}

          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "💾 Save Item"}
          </button>
          <Link href="/app/inventory" className="btn-outline block">
            📦 Go to Inventory
          </Link>
        </form>
      )}
    </Shell>
  );
}
