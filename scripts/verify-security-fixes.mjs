// DukaanPay — security-fix verification harness.
// Stages (run one at a time):
//   node scripts/verify-security-fixes.mjs connect
//   node scripts/verify-security-fixes.mjs apply-migration [--demote-staff]
//   node scripts/verify-security-fixes.mjs check-db
//   node scripts/verify-security-fixes.mjs make-users
//   node scripts/verify-security-fixes.mjs probe
//   node scripts/verify-security-fixes.mjs check-notification
//   node scripts/verify-security-fixes.mjs cleanup
//
// Requires DP_PG_PASSWORD env var (Postgres role password).
// Reads Supabase URL/keys from .env.local. Never prints secrets.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const STATE_FILE = path.join(ROOT, "scripts", ".verify-state.json");

// ---------- config ----------
function readEnv() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const get = (k) => {
    const m = txt.match(new RegExp(`^${k}=(.*)$`, "m"));
    return m ? m[1].trim() : null;
  };
  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  return {
    url,
    ref: new URL(url).hostname.split(".")[0],
    anon: get("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    service: get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
const ENV = readEnv();
const PG_PASSWORD = process.env.DP_PG_PASSWORD;
if (!PG_PASSWORD) {
  console.error("Set DP_PG_PASSWORD env var first.");
  process.exit(1);
}

const POOLER_REGIONS = [
  "ap-south-1", "ap-southeast-1", "ap-northeast-1",
  "us-east-1", "us-east-2", "us-west-1",
  "eu-west-1", "eu-west-2", "eu-central-1", "eu-north-1", "sa-east-1",
];

let CLIENT = null; // { kind, host, user, port }

async function tcpOpen(host, port, timeout = 4000) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (ok) => { s.destroy(); resolve(ok); };
    s.setTimeout(timeout);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
  });
}

async function findClient() {
  if (CLIENT) return CLIENT;
  const directHost = `db.${ENV.ref}.supabase.co`;
  if (await tcpOpen(directHost, 5432)) {
    CLIENT = { kind: "direct", host: directHost, user: "postgres", port: 5432 };
    return CLIENT;
  }
  for (const region of POOLER_REGIONS) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    if (await tcpOpen(host, 5432, 3000)) {
      CLIENT = { kind: "pooler", host, user: `postgres.${ENV.ref}`, port: 5432 };
      console.log(`(using pooler region ${region})`);
      return CLIENT;
    }
  }
  console.error("Could not reach Postgres (direct or pooler).");
  process.exit(2);
}

async function withPg(fn) {
  const c = await findClient();
  const client = new pg.Client({
    host: c.host, port: c.port, user: c.user, database: "postgres",
    password: PG_PASSWORD, ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// ---------- migration SQL (3 separate transactions; enum rule) ----------
const STEP1 = `alter type public.user_role add value if not exists 'user' after 'staff';`;

const STEP2 = `
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "owner update own shop" on public.businesses;
create policy "owner update own shop" on public.businesses
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "team update status" on public.businesses;
drop policy if exists "team update shops" on public.businesses;
create policy "team update shops" on public.businesses
  for update using (public.is_team());

create or replace function public.enforce_status_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' and public.is_team() is not true then
      raise exception 'New shops must start as pending; only the DukaanPay team can set status';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and public.is_team() is not true then
    raise exception 'Only the DukaanPay team can change business status';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_status_team_only on public.businesses;
create trigger trg_status_team_only
  before insert or update on public.businesses
  for each row execute function public.enforce_status_rules();

alter table public.profiles alter column role set default 'user';

update public.notifications set link = '/app' where link = '/business';

create or replace function public.notify_owner_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare t text; b text;
begin
  if new.status <> old.status then
    select name into b from public.businesses where id = new.id;
    if new.status = 'approved' then
      t := 'Shop approved 🎉';
    elsif new.status = 'rejected' then
      t := 'Shop request rejected';
    elsif new.status = 'suspended' then
      t := 'Shop suspended';
    end if;
    insert into public.notifications (user_id, title, body, link)
    values (new.owner_id, t, b || ' — status updated to ' || new.status::text || '.', '/app');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_unique_order_id on public.bills;
drop function if exists public.enforce_unique_order_suffix();
`;

const STEP3 = `update public.profiles set role = 'user' where role = 'staff';`;

// ---------- helpers ----------
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function rest(method, pathName, { token, key, body } = {}) {
  const res = await fetch(`${ENV.url}${pathName}`, {
    method,
    headers: {
      apikey: key ?? ENV.anon,
      Authorization: `Bearer ${token ?? key ?? ENV.anon}`,
      "Content-Type": "application/json",
      ...(method === "POST" ? { Prefer: "return=representation" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* html error pages */ }
  return { status: res.status, json, text };
}

const randSuffix = () => crypto.randomBytes(3).toString("hex");
const TEST_PASSWORD = "RlsVerify#2026x";

async function adminCreateUser(label) {
  const email = `rls-verify-${label}-${randSuffix()}@example.com`;
  const { status, json } = await rest("POST", "/auth/v1/admin/users", {
    key: ENV.service,
    body: { email, password: TEST_PASSWORD, email_confirm: true, user_metadata: { full_name: `RLS Verify ${label}` } },
  });
  if (status !== 201 && status !== 200) throw new Error(`create ${label}: ${status} ${JSON.stringify(json)}`);
  return { id: json.id, email, password: TEST_PASSWORD };
}

async function loginAs(u) {
  const { status, json } = await rest("POST", "/auth/v1/token?grant_type=password", {
    body: { email: u.email, password: u.password },
  });
  if (status !== 200) throw new Error(`login ${u.email}: ${status} ${JSON.stringify(json)}`);
  return json.access_token;
}

async function adminDeleteUser(id) {
  await rest("DELETE", `/auth/v1/admin/users/${id}`, { key: ENV.service });
}

// ---------- stages ----------
const stage = process.argv[2];

if (stage === "connect") {
  const rows = await withPg((c) => c.query("select current_user, version()"));
  console.log("connected as", rows.rows[0].current_user);
  console.log(rows.rows[0].version.split(",")[0]);
}

if (stage === "apply-migration") {
  // STEP 1
  await withPg((c) => c.query(STEP1));
  console.log("STEP 1 ok (enum value 'user' ensured)");
  // STEP 2
  await withPg((c) => c.query(STEP2));
  console.log("STEP 2 ok (functions, policies, triggers, notification links)");
  // STEP 3 — check for real team members first
  const staff = await withPg((c) =>
    c.query("select p.id, p.full_name, coalesce(u.email,'(no email)') as email from public.profiles p left join auth.users u on u.id = p.id where p.role = 'staff'")
  );
  if (staff.rows.length === 0) {
    await withPg((c) => c.query(STEP3));
    console.log("STEP 3 ok (no real staff members; nothing to preserve)");
  } else if (process.argv.includes("--demote-staff")) {
    await withPg((c) => c.query(STEP3));
    console.log("STEP 3 ok (staff rows demoted per confirmation). Re-promote real teammates from the admin Team page if needed:");
    for (const r of staff.rows) console.log(`  - ${r.email} (${r.full_name || "no name"})`);
  } else {
    console.log("⚠ Existing 'staff' profiles found — NOT demoting automatically:");
    for (const r of staff.rows) console.log(`  - ${r.email} (${r.full_name || "no name"}) id=${r.id}`);
    console.log("If these are real team members you want to keep, re-promote after: rerun with --demote-staff, or skip STEP 3.");
    process.exitCode = 2;
  }
}

if (stage === "check-db") {
  await withPg(async (c) => {
    const enumVals = (await c.query("select unnest(enum_range(null::public.user_role)) v order by v")).rows.map((r) => r.v);
    check("enum user_role contains 'user'", enumVals.includes("user"), enumVals.join(","));

    const fnSrc = (await c.query("select prosrc from pg_proc where proname='handle_new_user'")).rows[0]?.prosrc ?? "";
    check("handle_new_user inserts role 'user'", fnSrc.includes("'user'") && !fnSrc.includes("'staff'"));

    const def = (await c.query("select column_default from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role'")).rows[0]?.column_default;
    check("profiles.role default is 'user'", (def ?? "").includes("'user'"), def ?? "none");

    const policies = (await c.query("select policyname, cmd from pg_policies where schemaname='public' and tablename='businesses' order by policyname")).rows;
    const ownerPol = policies.find((p) => p.policyname === "owner update own shop");
    const teamPol = policies.find((p) => p.policyname === "team update shops");
    check("policies 'owner update own shop' + 'team update shops' exist", !!ownerPol && !!teamPol);

    const trig = (await c.query("select tgname, tgrelid::regclass as tbl from pg_trigger where not tgisinternal and tgname in ('trg_status_team_only','trg_unique_order_id')")).rows;
    check("trigger trg_status_team_only on businesses", trig.some((t) => t.tgname === "trg_status_team_only" && String(t.tbl).includes("businesses")));
    check("trigger trg_unique_order_id removed", !trig.some((t) => t.tgname === "trg_unique_order_id"));

    const deadLinks = (await c.query("select count(*)::int n from public.notifications where link = '/business'")).rows[0].n;
    check("no notifications with dead '/business' link", deadLinks === 0, `${deadLinks} remaining`);

    const fnSrc2 = (await c.query("select prosrc from pg_proc where proname='notify_owner_status_change'")).rows[0]?.prosrc ?? "";
    check("notify_owner_status_change links to '/app'", fnSrc2.includes("'/app'") && !fnSrc2.includes("'/business'"));

    const staffCount = (await c.query("select count(*)::int n from public.profiles where role='staff'")).rows[0].n;
    check("no leftover 'staff' profiles (all demoted or none existed)", staffCount === 0, `${staffCount} staff rows`);
  });
  if (failures) process.exitCode = 1;
}

if (stage === "make-users") {
  const a = await adminCreateUser("A");
  const b = await adminCreateUser("B");
  const [tokenA, tokenB] = [await loginAs(a), await loginAs(b)];
  const profileA = await rest("GET", "/rest/v1/profiles?select=id,role", { token: tokenA });
  check("signup profile created with role 'user'", profileA.json?.length === 1 && profileA.json[0].role === "user", JSON.stringify(profileA.json));
  fs.writeFileSync(STATE_FILE, JSON.stringify({ a: { ...a, token: tokenA }, b: { ...b, token: tokenB } }, null, 2));
  console.log("state saved to scripts/.verify-state.json (delete via `cleanup`)");
}

if (stage === "probe") {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  const A = st.a, B = st.b;

  // 1. A sees only own profile
  const profA = await rest("GET", "/rest/v1/profiles?select=id", { token: A.token });
  check("A: profiles visible = only self", profA.json?.length === 1 && profA.json[0].id === A.id, `got ${profA.json?.length ?? "?"} rows`);

  // 2. A sees no businesses yet
  const bizA0 = await rest("GET", "/rest/v1/businesses?select=id", { token: A.token });
  check("A: businesses visible = none", bizA0.json?.length === 0, `got ${bizA0.json?.length ?? "?"}`);

  // 3. A creates own shop
  const shop = await rest("POST", "/rest/v1/businesses", { token: A.token, body: { owner_id: A.id, name: "RLS Verify Shop", business_type: "Other" } });
  check("A: can create own shop (pending)", shop.status === 201 && shop.json?.[0]?.status === "pending", `status ${shop.status}`);
  const shopId = shop.json?.[0]?.id;

  // 4. A tries to self-approve (must fail; status stays pending)
  const approve = await rest("PATCH", `/rest/v1/businesses?id=eq.${shopId}`, { token: A.token, body: { status: "approved" } });
  const bizA1 = await rest("GET", `/rest/v1/businesses?id=eq.${shopId}&select=status`, { token: A.token });
  check("A: cannot self-approve shop", !(approve.status >= 200 && approve.status < 300) || bizA1.json?.[0]?.status === "pending",
    approve.status >= 300 ? `blocked with HTTP ${approve.status}` : `HTTP ${approve.status} but status=${bizA1.json?.[0]?.status}`);

  // 4b. A tries to insert a second shop directly as 'approved' (must fail)
  const cheat = await rest("POST", "/rest/v1/businesses", { token: A.token, body: { owner_id: A.id, name: "RLS Cheat Shop", business_type: "Other", status: "approved" } });
  check("A: cannot insert shop as 'approved'", cheat.status >= 300, `HTTP ${cheat.status}`);

  // 5. A can still edit own shop DETAILS (regression check for column policy)
  const edit = await rest("PATCH", `/rest/v1/businesses?id=eq.${shopId}`, { token: A.token, body: { shop_phone: "9999999999" } });
  const bizA2 = await rest("GET", `/rest/v1/businesses?id=eq.${shopId}&select=shop_phone,status`, { token: A.token });
  check("A: can still edit own shop details", edit.status === 204 && bizA2.json?.[0]?.shop_phone === "9999999999", `HTTP ${edit.status}, phone=${bizA2.json?.[0]?.shop_phone}`);

  // 6. A creates a bill for own shop
  const bill = await rest("POST", "/rest/v1/bills", { token: A.token, body: { business_id: shopId, order_id: `VRF${randSuffix().toUpperCase()}`, items: [], total_amount: 1 } });
  check("A: can create own bill", bill.status === 201, `HTTP ${bill.status}`);

  // 7. B (other signup) sees nothing cross-tenant
  const bizB = await rest("GET", "/rest/v1/businesses?select=id", { token: B.token });
  check("B: sees NO businesses (cross-tenant blocked)", bizB.json?.length === 0, `got ${bizB.json?.length ?? "?"}`);
  const billsB = await rest("GET", "/rest/v1/bills?select=id", { token: B.token });
  check("B: sees NO bills (cross-tenant blocked)", billsB.json?.length === 0, `got ${billsB.json?.length ?? "?"}`);
  const profB = await rest("GET", "/rest/v1/profiles?select=id", { token: B.token });
  check("B: sees only own profile", profB.json?.length === 1 && profB.json[0].id === B.id, `got ${profB.json?.length ?? "?"}`);

  // 8. B tries to modify A's shop / insert a bill into A's shop
  const patchB = await rest("PATCH", `/rest/v1/businesses?id=eq.${shopId}`, { token: B.token, body: { name: "HACKED" } });
  const afterPatch = await rest("GET", `/rest/v1/businesses?id=eq.${shopId}&select=name`, { key: ENV.service });
  check("B: cannot modify A's shop", !(patchB.status >= 200 && patchB.status < 300) || afterPatch.json?.[0]?.name === "RLS Verify Shop", `HTTP ${patchB.status}`);
  const billB = await rest("POST", "/rest/v1/bills", { token: B.token, body: { business_id: shopId, order_id: `VRF${randSuffix().toUpperCase()}`, items: [], total_amount: 1 } });
  check("B: cannot insert bill into A's shop", billB.status >= 300, `HTTP ${billB.status}`);

  // 9. B cannot read A's notifications
  const notifB = await rest("GET", "/rest/v1/notifications?select=id", { token: B.token });
  check("B: sees no notifications", notifB.json?.length === 0, `got ${notifB.json?.length ?? "?"}`);

  // 10. Sanity: service role still sees the shop (RLS bypassed by service role)
  const svc = await rest("GET", "/rest/v1/businesses?select=id,name", { key: ENV.service });
  check("service role can still see all shops (sanity)", svc.json?.some((r) => r.id === shopId), `got ${svc.json?.length ?? "?"}`);
}

if (stage === "check-notification") {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  await withPg(async (c) => {
    const rows = (await c.query("select title, body, link from public.notifications where user_id = $1 order by created_at desc", [st.a.id])).rows;
    check("shop status was approved by team (trigger allowed it)", rows.length > 0, `found ${rows.length} notification(s)`);
    const latest = rows[0];
    check("approval notification link is '/app'", latest?.link === "/app", `link=${latest?.link}`);
    check("approval notification has 🎉 title", /approved/i.test(latest?.title ?? ""), latest?.title);
  });
  if (failures) process.exitCode = 1;
}

if (stage === "cleanup") {
  const st = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  await adminDeleteUser(st.a.id);
  await adminDeleteUser(st.b.id);
  const gone = await withPg(async (c) => {
    const r1 = (await c.query("select count(*)::int n from public.profiles where id = any($1::uuid[])", [[st.a.id, st.b.id]])).rows[0].n;
    const r2 = (await c.query("select count(*)::int n from public.businesses where name = 'RLS Verify Shop'")).rows[0].n;
    return { profiles: r1, shops: r2 };
  });
  check("test users removed", gone.profiles === 0, `${gone.profiles} left`);
  check("test shop removed (cascade)", gone.shops === 0, `${gone.shops} left`);
  fs.rmSync(STATE_FILE, { force: true });
  console.log("state file deleted");
  if (failures) process.exitCode = 1;
}
