"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site-url";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        // Where the "Confirm your email" link sends the user. Must be an
        // absolute URL; local dev uses localhost, production uses SITE_URL.
        emailRedirectTo: `${SITE_URL}/login`,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/app");
    } else {
      setError("Account created! Check your email to confirm your address, then sign in.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Link href="/" className="mb-6 text-center text-2xl font-extrabold">
        Dukaan<span className="text-[#0ea75f]">Pay</span>
      </Link>
      <form onSubmit={submit} className="card space-y-3">
        <h1 className="text-lg font-bold">Create Shop Owner Account</h1>
        <div>
          <label className="label">Your full name</label>
          <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Yasir Khan" />
        </div>
        <div>
          <label className="label">Mobile number</label>
          <input className="input" required type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <label className="label">Password (min 6 chars)</label>
          <input className="input" required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Creating account…" : "Sign Up"}
        </button>
        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0ea75f]">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
