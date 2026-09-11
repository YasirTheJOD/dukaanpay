"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useBiz, uploadImage } from "@/lib/biz";
import { BUSINESS_TYPES } from "@/lib/constants";
import { Shell } from "@/components/shell";

export default function ApplyPage() {
  const router = useRouter();
  const { reload, businesses, currentId, setCurrentId } = useBiz();
  const [form, setForm] = useState({
    name: "",
    business_type: BUSINESS_TYPES[0],
    work_type: "",
    address: "",
    shop_phone: "",
    shop_email: "",
    owner_name: "",
    owner_phone: "",
    owner_email: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [ownerPhoto, setOwnerPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const shop_logo_url = logoFile ? await uploadImage(logoFile, "shops") : null;
      const owner_photo_url = ownerPhoto ? await uploadImage(ownerPhoto, "owners") : null;

      const { error } = await supabase.from("businesses").insert({
        owner_id: user.id,
        ...form,
        shop_logo_url,
        owner_photo_url,
        status: "pending",
      });
      if (error) throw error;

      await reload();
      router.push("/app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Apply for New Shop" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId} hideNav>
      <form onSubmit={submit} className="space-y-4">
        <div className="card space-y-3">
          <h2 className="font-bold">🏪 Shop details</h2>
          <div>
            <label className="label">Shop name *</label>
            <input className="input" required value={form.name} onChange={set("name")} placeholder="e.g. Sharma General Store" />
          </div>
          <div>
            <label className="label">Business type *</label>
            <select className="input" value={form.business_type} onChange={set("business_type")}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Work type / type of services *</label>
            <input className="input" required value={form.work_type} onChange={set("work_type")} placeholder="e.g. Mobile repair & accessories, Rice, pulses, spices" />
          </div>
          <div>
            <label className="label">Shop address *</label>
            <textarea className="input" required rows={2} value={form.address} onChange={set("address")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Shop phone</label>
              <input className="input" type="tel" value={form.shop_phone} onChange={set("shop_phone")} />
            </div>
            <div>
              <label className="label">Shop email</label>
              <input className="input" type="email" value={form.shop_email} onChange={set("shop_email")} />
            </div>
          </div>
          <div>
            <label className="label">Shop photo / logo (optional)</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-bold">👤 Owner details</h2>
          <div>
            <label className="label">Owner name *</label>
            <input className="input" required value={form.owner_name} onChange={set("owner_name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Owner phone *</label>
              <input className="input" required type="tel" value={form.owner_phone} onChange={set("owner_phone")} />
            </div>
            <div>
              <label className="label">Owner email *</label>
              <input className="input" required type="email" value={form.owner_email} onChange={set("owner_email")} />
            </div>
          </div>
          <div>
            <label className="label">Owner photo (optional)</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setOwnerPhoto(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Submitting…" : "Submit Application"}
        </button>
        <p className="text-center text-xs text-gray-500">
          Our team reviews applications within 24 hours. You&apos;ll get a notification here once approved.
        </p>
      </form>
    </Shell>
  );
}
