"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useBiz } from "@/lib/biz";
import { useProfile, useSession } from "@/lib/hooks";
import { Shell } from "@/components/shell";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfilePage() {
  const { businesses, currentId, setCurrentId } = useBiz();
  const { profile, profileLoading } = useProfile();
  const { email } = useSession();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load the current profile into the form once it arrives.
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setAddress((profile as { address?: string | null }).address ?? "");
    setAge(profile.age != null ? String(profile.age) : "");
    setGender((profile as { gender?: string | null }).gender ?? "");
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!profile) return;
    setSaveState("saving");
    setSaveError(null);
    const ageNum = age.trim() === "" ? null : Number(age);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        age: ageNum != null && Number.isFinite(ageNum) && ageNum > 0 ? ageNum : null,
        gender: gender.trim() === "" ? null : gender,
      })
      .eq("id", profile.id);
    if (error) {
      setSaveState("error");
      setSaveError(error.message);
      return;
    }
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2500);
  };

  return (
    <Shell
      title="Profile"
      businesses={businesses}
      currentBusinessId={currentId}
      onBusinessChange={setCurrentId}
      hideNav
    >
      {/* Personal identity card */}
      <div className="card flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0ea75f22] text-3xl">👤</div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold">{profile?.full_name || "Shop Owner"}</h2>
          <p className="truncate text-sm text-gray-600">✉️ {email || "—"}</p>
          <p className="text-xs text-gray-400">
            Member since {profile ? new Date(profile.created_at).toLocaleDateString("en-IN") : "—"}
          </p>
        </div>
      </div>

      {/* Editable details */}
      <form onSubmit={save} className="card mt-3 space-y-3">
        <h3 className="font-bold">Your details</h3>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Yasir Khan" />
        </div>
        <div>
          <label className="label">Mobile number</label>
          <input className="input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / street, area, city, PIN" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Age</label>
            <input
              className="input"
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 32"
            />
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">— select —</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        {saveError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{saveError}</p>}
        {saveState === "saved" && (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">✅ Profile saved</p>
        )}

        <button className="btn-primary" disabled={saveState === "saving" || profileLoading}>
          {saveState === "saving" ? "Saving…" : "Save profile"}
        </button>
        <p className="text-center text-xs text-gray-400">Email cannot be changed — it is your login.</p>
      </form>

      {/* Businesses list */}
      <div className="card mt-3">
        <h3 className="mb-2 font-bold">🏪 Listed businesses ({businesses.length})</h3>
        <div className="space-y-2">
          {businesses.map((b) => (
            <button
              key={b.id}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                b.id === currentId ? "border-[#0ea75f] bg-[#0ea75f08]" : "border-gray-200"
              }`}
              onClick={() => setCurrentId(b.id)}
            >
              <span>
                <span className="text-sm font-bold">{b.name}</span>
                <span className="block text-xs text-gray-500">{b.business_type}</span>
              </span>
              <span className={`chip ${b.status === "approved" ? "!border-green-300 !bg-green-50" : ""}`}>{b.status}</span>
            </button>
          ))}
          {businesses.length === 0 && <p className="text-sm text-gray-500">No businesses yet.</p>}
        </div>
        <Link href="/app/apply" className="btn-primary mt-3 block">
          ➕ Add New Business
        </Link>
      </div>

      <div className="card mt-3 space-y-2 text-sm">
        <h3 className="font-bold">Legal</h3>
        <Link href="/app/privacy" className="block font-semibold text-[#0ea75f]">🔒 Privacy Policy</Link>
        <Link href="/app/terms" className="block font-semibold text-[#0ea75f]">📜 Terms &amp; Conditions</Link>
      </div>
    </Shell>
  );
}
