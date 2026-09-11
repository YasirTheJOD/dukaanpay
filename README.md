# 🧾 DukaanPay

**Bills for every business.** A B2B billing platform by Yasir that helps local Indian shops
and service businesses create bills for products *and* services, and share them instantly
with customers as a beautiful invoice image (WhatsApp / any app).

One codebase → **Web app** (desktop + iPhone browsers) · **Android APK** (Capacitor) · **Admin Panel** (web-only).

## What's inside

| Area | Route | Who |
|---|---|---|
| Landing + signup/login | `/` `/signup` `/login` | Shop owners |
| My Businesses (switch shops, apply) | `/app` | Approved + pending owners |
| Apply for New Shop | `/app/apply` | Anyone with an account |
| Create New Item / Add Category | `/app/items/new` `/app/categories/new` | Approved owners |
| Inventory (search/sort/filter/edit) | `/app/inventory` | Approved owners |
| Create New Bill (smart units, labor, checkout) | `/app/new-bill` | Approved owners |
| History & Finance Stats (dates, search, resend) | `/app/history` | Approved owners |
| Support chat with DukaanPay team | `/app/support` | All owners |
| Profile / Notifications / Privacy / Terms | `/app/...` | All owners |
| **Admin Panel** (web-only, URL-secured) | `/admin` | Yasir (Lead Owner) + managers |
| Admin · Shop Owners list | `/admin/owners` | Team |
| Admin · Team (assign/remove managers) | `/admin/team` | Lead Owner |

## Core principles (per spec)

- ✅ **Yasir is the Lead Owner** — the only team role he can grant is **manager**, via “＋ Assign New
  Manager” (he sets their email + password; the invitation message with credentials is shown to copy).
  Shop-owner accounts never get any team role by default.
- ✅ **No revenue tracking** — admin sees shop & owner details and status only.
- ✅ **Multi-business** — owners add unlimited shops, switch anytime.
- ✅ **24-hour approvals** with automatic in-app notification on decision.
- ✅ **Smart units** — save 1kg rice @ ₹100, bill 700g → ₹70 automatically (kg↔g, L↔mL).
- ✅ **Products + services in one bill**, labor charge editable at billing time.
- ✅ **Order ID `DDMMYYXXX`** — random, unique, non-sequential (e.g. `100926435`).
- ✅ **Invoice image** — shop name/address/phone/email/owner, items, total, thank-you footer.
- ✅ Every shop's data is isolated by **Postgres Row Level Security**.

## Setup

👉 Follow **[BUILD-APK.md](./BUILD-APK.md)** — Supabase setup, making yourself Lead Owner,
deploying the web app, and building the APK. The full database schema (tables, triggers, RLS,
storage bucket) lives in **`supabase/schema.sql`**.

> **Status (Sep 2026):** web app deployed to Vercel ✅ · debug APK built and installed on a
> device via adb ✅. The exact proven Windows APK toolchain (JDK 21, SDK components, adb)
> is documented in [BUILD-APK.md §5](./BUILD-APK.md).
> Git → Vercel is connected: every `git push` to `main` auto-deploys the web app.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage + Realtime) · html2canvas · Capacitor 8 (+ Share & Filesystem plugins for native invoice sharing).

## Scripts

- `npm run dev` — local dev
- `npm run build` — web build (deploys to Vercel; server routes enabled)
- `npm run build:apk` — static export to `./out` for the Capacitor APK (runs
  `scripts/build-apk.mjs`, Windows-safe — see [BUILD-APK.md §5](./BUILD-APK.md) for details)
- `npm run typecheck` — TypeScript check
