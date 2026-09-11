"use client";

import { Shell } from "@/components/shell";

export default function PrivacyPage() {
  return (
    <Shell title="Privacy Policy" businesses={[]} currentBusinessId={null} onBusinessChange={() => {}} hideNav>
      <div className="card space-y-3 text-sm leading-relaxed text-gray-700">
        <p><b>Last updated:</b> {new Date().getFullYear()}</p>
        <p>
          DukaanPay (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates a billing platform that helps
          shops and service businesses create and share invoices with their customers. This policy explains
          what we collect and how it is used.
        </p>
        <h3 className="font-bold">1. What we collect</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details you provide: name, phone number, email, password (stored securely by our auth provider).</li>
          <li>Business details you submit during shop application: shop name, address, contact details, photos.</li>
          <li>Items, categories and bills you create in the app, including customer name/number/email you optionally enter for billing.</li>
          <li>Support messages you send us.</li>
        </ul>
        <h3 className="font-bold">2. What we do NOT do</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>We do <b>not</b> track your sales amounts, revenue, or business performance.</li>
          <li>We do <b>not</b> sell your data or your customers&apos; data to anyone.</li>
          <li>We do <b>not</b> send marketing messages to your customers.</li>
        </ul>
        <h3 className="font-bold">3. How your data is stored</h3>
        <p>
          Data is stored in a secured cloud database (Supabase) with row-level security, meaning a shop can
          only ever read its own records. Invoices are generated on the owner&apos;s device and shared
          directly by the owner — we do not send invoices on your behalf in this version.
        </p>
        <h3 className="font-bold">4. Your customers&apos; data</h3>
        <p>
          Customer details (name, number, email) are stored only to keep your bill history and allow resending
          bills. Delete a bill&apos;s history by contacting support; we will remove it from our systems.
        </p>
        <h3 className="font-bold">5. Account deletion</h3>
        <p>
          You may request account and data deletion anytime from Support. We will process it within 30 days.
        </p>
        <h3 className="font-bold">6. Contact</h3>
        <p>Questions? Use the in-app Support section or write to the DukaanPay team.</p>
      </div>
    </Shell>
  );
}
