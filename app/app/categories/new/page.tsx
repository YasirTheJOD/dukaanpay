"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useBiz } from "@/lib/biz";
import { Shell } from "@/components/shell";
import type { ItemCategory } from "@/lib/types";

export default function NewCategoryPage() {
  const { businesses, currentId, setCurrentId, current, reload } = useBiz();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [cats, setCats] = useState<ItemCategory[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    if (!currentId) return;
    const { data } = await supabase.from("item_categories").select("*").eq("business_id", currentId).order("name");
    setCats((data as ItemCategory[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || current.status !== "approved" || !name.trim()) return;
    setMsg(null);
    const { error } = await supabase.from("item_categories").insert({ business_id: currentId, name: name.trim() });
    if (error) setMsg(`⚠️ ${error.message}`);
    else {
      setMsg(`✅ Category "${name.trim()}" added`);
      setName("");
      load();
    }
  };

  const remove = async (id: string) => {
    await supabase.from("item_categories").delete().eq("id", id);
    load();
  };

  const locked = !current || current.status !== "approved";

  return (
    <Shell title="Add Category" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId}>
      {locked ? (
        <div className="card text-center text-sm text-gray-600">Select an approved shop first (top bar).</div>
      ) : (
        <>
          <form onSubmit={add} className="card flex gap-2">
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rice & Grains, Repair Services" />
            <button className="rounded-xl bg-[#0ea75f] px-4 font-bold text-white">Add</button>
          </form>
          {msg && <p className="mt-2 rounded-xl bg-[#0ea75f14] p-3 text-sm font-semibold text-[#067a45]">{msg}</p>}

          <div className="mt-4 space-y-2">
            {cats.length === 0 && <p className="text-center text-sm text-gray-500">No categories yet — items work fine without them too.</p>}
            {cats.map((c) => (
              <div key={c.id} className="card flex items-center justify-between !py-3">
                <span className="font-semibold">🗂️ {c.name}</span>
                <button className="text-sm font-bold text-red-500" onClick={() => remove(c.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
          <button className="mt-4 text-sm font-semibold text-gray-500" onClick={() => reload()}>
            ↻ Refresh shop list
          </button>
        </>
      )}
    </Shell>
  );
}
