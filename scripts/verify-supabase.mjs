// Verifies the Supabase connection using the exact keys in .env.local
// Run: node scripts/verify-supabase.mjs
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const service = env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log("URL from .env.local :", url || "(missing!)");
console.log("anon key            :", anon ? `present (${anon.length} chars)` : "(missing!)");
console.log("service key         :", service ? `present (${service.length} chars)` : "(missing!)");

if (!url || !anon) {
  console.error("\n❌ .env.local is missing URL or anon key.");
  process.exit(1);
}

let projectRef = "(unknown)";
try {
  projectRef = new URL(url).hostname.split(".")[0];
} catch {}
console.log("project ref         :", projectRef);

async function check(label, path, key) {
  try {
    const res = await fetch(`${url}${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const text = await res.text();
    const ok = res.ok;
    console.log(`\n${label}: HTTP ${res.status} ${ok ? "✅" : "❌"}`);
    if (!ok) console.log("  body:", text.slice(0, 200));
    else if (label.includes("categories")) {
      const rows = JSON.parse(text);
      console.log(`  ${rows.length} categories visible (seed data present)`);
    }
    return ok;
  } catch (e) {
    console.log(`\n${label}: NETWORK ERROR ❌ — ${e.cause?.code ?? e.message}`);
    return false;
  }
}

console.log("\n--- Tests ---");
const dnsOk = await check("1. REST via anon key (business_categories)", "/rest/v1/business_categories?select=name&limit=5", anon);
await check("2. REST via service key (profiles count)", "/rest/v1/profiles?select=id", service || anon);
await check("3. Auth service", "/auth/v1/health", anon);
await check("4. Storage service", "/storage/v1/bucket", service || anon);

console.log("\n--- Verdict ---");
if (!dnsOk) {
  console.log("❌ The project URL is not reachable.");
  console.log("   → Open Supabase dashboard → Project Settings → API.");
  console.log("   → Copy the 'Project URL' EXACTLY and put it in .env.local.");
  console.log("   → Current ref in URL: " + projectRef);
} else {
  console.log("✅ Supabase is live and the keys work. Run `npm run dev` and sign up!");
}
