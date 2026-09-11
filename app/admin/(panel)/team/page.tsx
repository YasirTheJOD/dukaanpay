"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useProfile } from "@/lib/hooks";
import type { Profile } from "@/lib/types";

/**
 * Team page — only the Lead Owner and Managers.
 * Shop-owner accounts are NOT shown here (see the separate Owners page).
 * The Lead Owner can invite a Manager (email + password chosen here,
 * credentials displayed once for sharing) and remove managers again.
 */
export default function AdminTeamPage() {
  const supabase = createClient();
  const { profile: me } = useProfile();
  const [team, setTeam] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [inviting, setInviting] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invPass, setInvPass] = useState("");
  const [invBusy, setInvBusy] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string; full_name: string } | null>(null);

  const [confirmRemove, setConfirmRemove] = useState<Profile | null>(null);

  const isLead = me?.role === "owner";

  const load = useCallback(async () => {
    // Team accounts only — ordinary shop owners (role 'user') live on the Owners page.
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["owner", "manager"])
      .order("role", { ascending: false })
      .order("created_at", { ascending: true });
    setTeam((data as Profile[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () =>
      team.filter((u) => {
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return u.full_name.toLowerCase().includes(s) || (u.phone ?? "").includes(s);
      }),
    [team, q]
  );

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvBusy(true);
    setInvError(null);
    try {
      const res = await fetch("/api/admin/create-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invEmail, password: invPass, full_name: invName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create the manager account.");
      setCreated({ email: json.credentials.email, password: json.credentials.password, full_name: invName });
      setInviting(false);
      setInvEmail("");
      setInvName("");
      setInvPass("");
      load();
    } catch (err) {
      setInvError((err as Error).message);
    } finally {
      setInvBusy(false);
    }
  };

  const removeManager = async (m: Profile) => {
    setMsg(null);
    const { error } = await supabase.from("profiles").update({ role: "user" }).eq("id", m.id);
    if (error) setMsg(`⚠️ ${error.message}`);
    else setMsg(`✅ ${m.full_name || "Manager"} removed from the team (account kept as a shop owner).`);
    setConfirmRemove(null);
    load();
  };

  const inviteMessage = created
    ? `You have been invited as a Manager on DukaanPay 🎉\n\nYou can now log in on the DukaanPay Admin (Team) login page and help manage shop approvals and support.\n\nAdmin login: ${typeof window !== "undefined" ? window.location.origin : ""}/admin/login\nEmail: ${created.email}\nPassword: ${created.password}\n\nPlease change your password after your first login.`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-extrabold">Team</h1>
        <div className="ml-auto flex items-center gap-2">
          <input className="input !w-48" placeholder="Search name / phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          {isLead && (
            <button className="btn-primary !py-2" onClick={() => { setInviting(true); setCreated(null); }}>
              ＋ Assign New Manager
            </button>
          )}
        </div>
      </div>

      <div className="card bg-blue-50 text-sm">
        <b>Managers</b> can approve shops and answer support tickets in this Team Panel. Shop-owner
        accounts are listed separately under <b>Owners</b> — they never receive a role automatically.
        {!isLead && " Only the Lead Owner can invite or remove managers."}
      </div>
      {msg && <p className="rounded-xl bg-[#0ea75f14] p-3 text-sm font-semibold text-[#067a45]">{msg}</p>}

      <div className="space-y-2">
        {shown.map((u) => (
          <div key={u.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">
                {u.full_name || "(no name)"}{" "}
                {u.id === me?.id && <span className="text-xs font-normal text-gray-400">(you)</span>}
              </div>
              <div className="text-xs text-gray-500">📞 {u.phone || "—"} · joined {new Date(u.created_at).toLocaleDateString("en-IN")}</div>
            </div>
            <span className={`chip ${u.role === "owner" ? "!border-amber-300 !bg-amber-50" : "!border-blue-300 !bg-blue-50"}`}>
              {u.role === "owner" ? "Lead Owner" : "Manager"}
            </span>
            {isLead && u.role === "manager" && (
              <button className="btn-outline !border-red-200 !py-2 !text-red-600" onClick={() => setConfirmRemove(u)}>
                Remove from team
              </button>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No team members yet.</p>}
      </div>

      {/* Invite manager modal */}
      {inviting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !invBusy && setInviting(false)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">Assign New Manager</h2>
            <p className="text-sm text-gray-600">
              Choose their login now. You&apos;ll get the credentials + an invitation message to share
              with them right after.
            </p>
            <form onSubmit={invite} className="space-y-3">
              <div>
                <label className="label">Manager name</label>
                <input className="input" required value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="e.g. Imran" />
              </div>
              <div>
                <label className="label">Email (their login)</label>
                <input className="input" required type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="manager@example.com" />
              </div>
              <div>
                <label className="label">Password (min 6 chars)</label>
                <input className="input" required minLength={6} type="text" value={invPass} onChange={(e) => setInvPass(e.target.value)} placeholder="Set a password they should use" />
              </div>
              {invError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{invError}</p>}
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={invBusy}>
                  {invBusy ? "Creating…" : "Create Manager"}
                </button>
                <button type="button" className="btn-outline" onClick={() => setInviting(false)} disabled={invBusy}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials + invitation message modal */}
      {created && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreated(null)}>
          <div className="max-h-[85vh] w-full max-w-md space-y-3 overflow-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">✅ Manager created</h2>
            <p className="text-sm text-gray-600">Share these login details with {created.full_name || "your manager"} — this is the only time the password is shown.</p>
            <div className="rounded-xl bg-gray-50 p-3 font-mono text-sm">
              <div>Admin login: {typeof window !== "undefined" ? window.location.origin : ""}/admin/login</div>
              <div>Email: {created.email}</div>
              <div>Password: {created.password}</div>
            </div>
            {inviteMessage && (
              <>
                <label className="label">Invitation message (copy &amp; send)</label>
                <textarea className="input text-xs" rows={6} readOnly value={inviteMessage} />
                <button
                  className="btn-primary w-full"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteMessage);
                      setMsg("✅ Invitation message copied to clipboard.");
                    } catch {
                      setMsg("⚠️ Could not copy automatically — select the text and copy manually.");
                    }
                  }}
                >
                  📋 Copy invitation message
                </button>
              </>
            )}
            <button className="btn-outline w-full" onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Remove manager confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmRemove(null)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">Remove from team?</h2>
            <p className="text-sm text-gray-600">
              {confirmRemove.full_name || "This manager"} will lose Team Panel access. Their account
              stays as a normal shop owner and any shops they own are not affected.
            </p>
            <div className="flex gap-2">
              <button className="btn-outline !border-red-300 !text-red-600" onClick={() => removeManager(confirmRemove)}>
                Yes, remove
              </button>
              <button className="btn-outline flex-1" onClick={() => setConfirmRemove(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
