import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-6">
      <div className="mb-8 text-center">
        <div className="mb-2 text-5xl">🧾</div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Dukaan<span className="text-[#0ea75f]">Pay</span>
        </h1>
        <p className="mt-2 text-gray-600">
          Create bills for products & services and send them straight to your customers —
          on WhatsApp or as an image. Built for every local shop.
        </p>
      </div>

      <div className="space-y-3">
        <Link href="/signup" className="btn-primary block">
          Create Shop Owner Account
        </Link>
        <Link href="/login" className="btn-outline block">
          Sign In
        </Link>
      </div>

      <ul className="mt-8 space-y-2 text-sm text-gray-600">
        <li>✅ Products & services in one bill, with labor charge</li>
        <li>✅ Smart units — sell 700g of 1kg pack, price auto-calculates</li>
        <li>✅ Beautiful invoice image with Order ID, shared in one tap</li>
        <li>✅ History, finance stats & resend anytime</li>
        <li>✅ Works on phone, desktop — same account everywhere</li>
      </ul>

      <div className="mt-10 text-center text-xs text-gray-400">
        DukaanPay by Yasir ·{" "}
        <Link href="/admin/login" className="underline">
          Team / Admin Login
        </Link>
      </div>
    </main>
  );
}
