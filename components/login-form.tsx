"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function LoginForm({ admin }: { admin?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Supabase redirects here with ?error=... (or #error=...) when an email link
  // is invalid, already used, or expired. Capture the message once at mount,
  // then scrub the params from the address bar so the URL looks clean.
  const [emailLinkError] = useState(() => {
    const hashParams = new URLSearchParams(
      typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : ""
    );
    const hasError =
      params.get("error") ||
      params.get("error_code") ||
      hashParams.get("error") ||
      hashParams.get("error_code");
    if (!hasError) return null;
    const code = params.get("error_code") ?? hashParams.get("error_code") ?? "";
    const desc = params.get("error_description") ?? hashParams.get("error_description") ?? "";
    return code === "otp_expired" || /expired/i.test(desc)
      ? "That email link has expired or was already used. Just sign in with your email and password below."
      : "We couldn't verify that email link. Sign in with your email and password below, or create a new account.";
  });

  useEffect(() => {
    if (!emailLinkError || typeof window === "undefined") return;
    const clean = new URL(window.location.href);
    clean.search = "";
    clean.hash = "";
    if (next) clean.searchParams.set("next", next);
    window.history.replaceState(null, "", clean.toString());
  }, [emailLinkError, next]);

  // Email confirmation links sign the user in via URL tokens (client side).
  // When that happens, go straight into the app instead of leaving them here.
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" &&
        typeof window !== "undefined" &&
        window.location.hash.includes("access_token")
      ) {
        router.replace(admin ? "/admin" : next && next.startsWith("/app") ? next : "/app");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, admin, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (admin) {
      // verify role before entering admin area
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      const role = (prof as { role?: string } | null)?.role;
      if (role !== "owner" && role !== "manager" && role !== "staff") {
        await supabase.auth.signOut();
        setError("This account is not part of the DukaanPay team.");
        return;
      }
      router.push("/admin");
      return;
    }
    router.push(next && next.startsWith("/app") ? next : "/app");
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      {admin ? <h1 className="text-lg font-bold">DukaanPay Team Login</h1> : <h1 className="text-lg font-bold">Welcome back</h1>}
      {emailLinkError && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">{emailLinkError}</p>
      )}
      <div>
        <label className="label">Email</label>
        <input className="input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Signing in…" : "Sign In"}
      </button>
      {!admin && (
        <p className="text-center text-sm text-gray-600">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-[#0ea75f]">
            Create account
          </Link>
        </p>
      )}
    </form>
  );
}
