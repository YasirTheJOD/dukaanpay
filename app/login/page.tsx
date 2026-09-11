"use client";

import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Link href="/" className="mb-6 text-center text-2xl font-extrabold">
        Dukaan<span className="text-[#0ea75f]">Pay</span>
      </Link>
      <Suspense fallback={<div className="card text-center text-sm text-gray-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
