// One-off: create (or fix) the Lead Owner account.
// Usage: DP_PG_PASSWORD=... DP_OWNER_EMAIL=... DP_OWNER_PASS=... node scripts/make-owner.mjs
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const get = (k) => {
  const m = txt.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : null;
};
const URL = get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE = get("SUPABASE_SERVICE_ROLE_KEY");
const EMAIL = process.env.DP_OWNER_EMAIL;
const PASS = process.env.DP_OWNER_PASS;
if (!EMAIL || !PASS || !URL || !SERVICE) {
  console.error("missing env inputs");
  process.exit(1);
}

const rest = async (method, p, body) => {
  const res = await fetch(`${URL}${p}`, {
    method,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json, text };
};

(async () => {
  // 1. create or reuse the auth user
  let r = await rest("POST", "/auth/v1/admin/users", {
    email: EMAIL, password: PASS, email_confirm: true, user_metadata: { full_name: "Yasir" },
  });
  if (r.status === 201 || r.status === 200) console.log("auth user created:", r.json?.id);
  else if (r.status === 422) console.log("auth user already exists — reusing");
  else {
    console.error("create failed:", r.status, r.text.slice(0, 300));
    process.exit(1);
  }

  // 2. fetch its id
  const c = new pg.Client({
    host: "aws-0-ap-south-1.pooler.supabase.com", port: 5432,
    user: "postgres.oitfbaggowoiwhexaysb", database: "postgres",
    password: process.env.DP_PG_PASSWORD, ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await c.connect();
  const u = (await c.query("select id from auth.users where email = $1", [EMAIL])).rows[0];
  if (!u) { console.error("user not found in auth.users"); process.exit(1); }
  console.log("auth id:", u.id);

  // 3. (re)set password + confirm email, so login definitely works
  const put = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
    method: "PUT",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASS, email_confirm: true }),
  });
  if (put.status !== 200) {
    console.error("password set failed:", put.status, (await put.text()).slice(0, 300));
    process.exit(1);
  }
  console.log("password set OK (email confirmed)");

  // 4. promote to owner in profiles
  const prof = (await c.query("select id from public.profiles where id = $1", [u.id])).rows[0];
  if (prof) await c.query("update public.profiles set role = 'owner' where id = $1", [u.id]);
  else
    await c.query(
      "insert into public.profiles (id, full_name, phone, role) values ($1, 'Yasir', '', 'owner') on conflict (id) do update set role = 'owner'",
      [u.id]
    );
  const after = (await c.query("select role, full_name from public.profiles where id = $1", [u.id])).rows[0];
  console.log("profile:", after.full_name, "| role =", after.role);
  await c.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
