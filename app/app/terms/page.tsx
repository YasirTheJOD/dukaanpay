"use client";

import { Shell } from "@/components/shell";

export default function TermsPage() {
  return (
    <Shell title="Terms & Conditions" businesses={[]} currentBusinessId={null} onBusinessChange={() => {}} hideNav>
      <div className="card space-y-3 text-sm leading-relaxed text-gray-700">
        <p><b>Last updated:</b> {new Date().getFullYear()}</p>
        <h3 className="font-bold">1. Using DukaanPay</h3>
        <p>
          DukaanPay is a billing tool for shop and service-business owners. By creating an account you agree
          to provide accurate business details during shop application and to keep them updated.
        </p>
        <h3 className="font-bold">2. Shop approval</h3>
        <p>
          Every shop application is reviewed by the DukaanPay team, usually within 24 hours. We may approve,
          reject or suspend a shop to keep the platform safe and spam-free. Approval of one shop does not
          guarantee approval of others.
        </p>
        <h3 className="font-bold">3. Fair use</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Do not use DukaanPay for illegal goods or services, or to evade taxes.</li>
          <li>You are responsible for the accuracy of the bills you create and share.</li>
          <li>Do not attempt to access other shops&apos; data or disrupt the service.</li>
        </ul>
        <h3 className="font-bold">4. Bills & communication</h3>
        <p>
          In this version, invoice images are generated on your device and shared by you (e.g., via WhatsApp).
          DukaanPay is not responsible for message delivery by third-party apps. Keep a backup of your
          bill history — it is retained while your account is active.
        </p>
        <h3 className="font-bold">5. Availability & changes</h3>
        <p>
          We aim for high availability but the service is provided &quot;as is&quot; without warranties. We may
          update these terms; continued use means you accept the updated terms.
        </p>
        <h3 className="font-bold">6. Ending the service</h3>
        <p>
          You may stop using DukaanPay and request deletion anytime. We may suspend accounts that violate
          these terms.
        </p>
        <h3 className="font-bold">7. Contact</h3>
        <p>For anything at all, use the in-app Support section — the DukaanPay team reads every message.</p>
      </div>
    </Shell>
  );
}
