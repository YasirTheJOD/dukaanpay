"use client";

import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Link href="/" className="mb-6 text-center text-2xl font-extrabold">
        Dukaan<span className="text-[#0ea75f]">Pay</span>{" "}
        <span className="text-xs font-bold uppercase text-gray-400">Team</span>
      </Link>
      <Suspense fallback={<div className="card text-center text-sm text-gray-500">Loading…</div>}>
        <LoginForm admin />
      </Suspense>
      <p className="mt-4 text-center text-xs text-gray-400">
        Team access only. Shop owners should use the main app.
      </p>
    </main>
  );
}
