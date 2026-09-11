# DukaanPay — Setup, Deploy & APK Guide

DukaanPay = one Next.js codebase → **Web app** (desktop/iOS browsers) + **Android APK** (Capacitor) + **Admin Panel** (web-only).

---

## 1. Create your Supabase backend (10 minutes, free)

1. Open the **"Create your Supabase account"** button above (or supabase.com) and create a project — any name, e.g. `dukaanpay`. Pick a region near India (Singapore/Mumbai) and set a **database password** (save it).
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, **Run**. This creates all tables, triggers, security rules and the storage bucket.
3. Go to **Project Settings → API**. Copy three values into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

## 2. Make yourself the Lead Owner

1. `npm run dev` → open http://localhost:3000 → **Sign up** with YOUR email (this is your team account).
2. Supabase Dashboard → **SQL Editor** → run, replacing the email:
   ```sql
   update public.profiles set role = 'owner'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Now visit **/admin** (web only) — your Team Panel is live. Log out/in once so the middleware picks up your role.

### Roles (important)
- Every signup is an ordinary **shop-owner account** (role `user`) — no team access, ever, by default.
- **Team = Lead Owner (you) + Managers.** Invite managers from **/admin → Team → ＋ Assign New Manager**:
  you type their name, email and a password; the account is created instantly and the page shows
  the credentials plus a copyable invitation message pointing them to **/admin/login**.
- Managers can be removed from the Team page (their account reverts to a normal shop owner).
- Shop-owner accounts are listed separately under **/admin → Owners** (with their shops + statuses).
- There is deliberately **no way** to assign `owner` or `staff` roles from the UI.

## 3. Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## 4. Publish the web app (works on desktop + iPhone)

```bash
npm run build        # web build (server routes enabled — what Vercel deploys)
npm run build:apk    # static export → ./out (only for the APK step; Windows-safe — see §5)
```
Deploy `dukaanpay` to Vercel (free): install Vercel CLI → `npx vercel` → add the env vars in the Vercel dashboard (the 3 Supabase vars **plus `SUPABASE_SERVICE_ROLE_KEY`**, used by the invite-manager API) → production URL. Any desktop or iPhone browser can now use the full app with the same account.

## 5. Build the Android APK

> Build the APK on any computer with Android Studio, or in a cloud CI. Phone browsers + the APK share the same Supabase backend, so accounts work everywhere.

Quick path (macOS/Linux or a machine with Android Studio configured):

```bash
npx cap add android
npm run build:apk           # static export → ./out (Windows-safe — details below)
npx cap sync android
npx cap open android        # opens Android Studio → Build > Build APK(s)
```

On Windows the steps below were **proven end-to-end** (Sep 2026) without opening Android Studio. Adjust paths to your machine where noted.

### 5.1 One-time Windows setup

**a. Install the missing Android SDK components.** Android Studio ships only `cmdline-tools` — platforms/build-tools/platform-tools download on first use. Run sdkmanager with Android Studio's bundled JDK:

```bash
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
yes | "$LOCALAPPDATA/Android/Sdk/cmdline-tools/latest/bin/sdkmanager.bat" \
  --sdk_root="$LOCALAPPDATA/Android/Sdk" \
  --install "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

**b. Point Gradle at the SDK** — create `android/local.properties` (git-ignored):

```properties
sdk.dir=C\:\\Users\\admin\\AppData\\Local\\Android\\Sdk
```

**c. Install JDK 21 (LTS).** Do **not** build with Android Studio's bundled JBR — it is Java 25 and Gradle 8.14.3 fails with `Unsupported class file major version 69`. AGP 8.13 wants Java 17–21:

```bash
curl -L --retry 5 -o jdk21.zip \
  "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse"
unzip -q jdk21.zip -d "$USERPROFILE/tools" && rm jdk21.zip
# → C:\Users\admin\tools\jdk-21.0.12.1+1
```

**d. If the Gradle download times out.** The wrapper gives up after 10s (`networkTimeout=10000` in `gradle-wrapper.properties`) — on slow networks you get `Connect timed out` for `gradle-8.14.3-all.zip`. Download it once by hand with retries and unpack it into the wrapper cache:

```bash
DIST="$USERPROFILE/.gradle/wrapper/dists/gradle-8.14.3-all/10utluxaxniiv4wxiphsi49nj"
curl -L --retry 5 --retry-all-errors -o "$DIST/gradle-8.14.3-all.zip" \
  "https://services.gradle.org/distributions/gradle-8.14.3-all.zip"
unzip -q "$DIST/gradle-8.14.3-all.zip" -d "$DIST" && rm "$DIST/gradle-8.14.3-all.zip"
```

> Verify the download with the official `gradle-8.14.3-all.zip.sha256` before unpacking. If the wrapper still insists on re-downloading, just call the unpacked `gradle.bat` directly (step 5.2) — that's what the wrapper runs anyway.

### 5.2 Build the APK (proven commands)

```bash
npm run build:apk          # static export → ./out (stop `npm run dev` first)
npx cap sync android       # copy ./out into the Android project
cd android
JAVA_HOME="C:/Users/admin/tools/jdk-21.0.12.1+1" \
  "$USERPROFILE/.gradle/wrapper/dists/gradle-8.14.3-all/10utluxaxniiv4wxiphsi49nj/gradle-8.14.3/bin/gradle.bat" \
  assembleDebug --console=plain --no-daemon
```

First run downloads AGP + AndroidX dependencies and takes ~8 minutes; later builds are much faster. Output:

```
android/app/build/outputs/apk/debug/app-debug.apk   (~8 MB, debug-signed)
```

The APK uses **@capacitor/share** + **@capacitor/filesystem** for native invoice
sharing (Web Share with files and blob downloads don't work inside a WebView).
Invoice PNGs are written to the app cache and handed to the Android share sheet —
`file_paths.xml` already whitelists `cache-path`, so no storage permission is needed.
Sessions persist across app restarts because the APK uses supabase-js with
localStorage (see `lib/supabase.ts`); the web app keeps the cookie-based client.

`JAVA_HOME` is set per-command, so nothing permanent is added to your environment.

For Play Store: **Build > Generate Signed Bundle** (AAB) in Android Studio, or `gradle.bat bundleRelease` with a signing config.

### 5.3 Install on a phone via adb

The SDK's `platform-tools` (installed in 5.1a) includes adb. On the phone: **Settings → About phone → tap Build number 7×**, then **Developer options → USB debugging ON**, plug in a **data** cable and accept the "Allow USB debugging?" popup. Some brands (Vivo/iQOO, Xiaomi, Oppo) also need **"USB debugging (Security settings)"** / **"Install via USB"** toggles, and the USB notification switched from *Charging only* to *File transfer (MTP)*.

```bash
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
"$ADB" devices -l                                        # device must say "device", not "unauthorized"
"$ADB" install -r android/app/build/outputs/apk/debug/app-debug.apk
"$ADB" shell am start -n com.dukaanpay.app/.MainActivity  # launch
"$ADB" shell pidof com.dukaanpay.app                      # prints a PID if running
```

Troubleshooting: if `adb devices` lists nothing, `adb kill-server`, switch the USB mode to MTP, or try another cable/port — charge-only cables never show up. If it says *unauthorized*, re-accept the debugging popup on the phone.

### How `npm run build:apk` works (Windows-safe)

`npm run build:apk` runs **`scripts/build-apk.mjs`**, a small Node wrapper around the
static export. It exists because a plain `BUILD_TARGET=capacitor next build` fails twice:

1. **On Windows:** npm runs package scripts through cmd.exe, which doesn't understand
   the POSIX `VAR=value command` syntax — you get `'BUILD_TARGET' is not recognized as an
   internal or external command`. The wrapper sets the env var in-process, so the script
   behaves identically on Windows, macOS and Linux — no `cross-env` needed.
2. **Server API routes:** the APK is a static shell (`webDir: "out"`) with no Node
   server, so `app/api/**` cannot exist in a static export — Next.js refuses to build
   them under `output: "export"`. They're not needed in the APK anyway: the app talks to
   Supabase directly, and the admin APIs live only on the Vercel deployment.

What the script does, in order:

1. **Self-recovery** — if a previous run was interrupted (e.g. Ctrl+C mid-build) and
   left `app/api` stashed away, it restores it before doing anything else.
2. Moves `app/api` → **`.apk-stash/api`** (temporarily). The stash sits *outside* `app/`
   on purpose: the App Router scans and compiles everything under `app/`, so a rename
   inside `app/` would still break the export.
3. Deletes `.next` so no stale compiled API routes leak into the export.
4. Runs `next build` with `BUILD_TARGET=capacitor` → static HTML of every page into `./out`.
5. **Always restores `app/api`** when the build finishes — success or failure — and
   removes the `.apk-stash` folder. The web build (`npm run build`) is never affected.

> **Tip:** stop `npm run dev` before running `npm run build:apk` — dev and build share
> the same `.next` folder.
>
> **If you ever see** “Both app/api and .apk-stash/api exist”, delete the `.apk-stash`
> folder (that's the leftover copy) and re-run the build.

## 6. Daily flow for shop owners

1. Sign up → **Apply for New Shop** (shop + owner details, photos).
2. You (or your team) approve at `/admin` → owner gets a notification + email confirmation.
3. Owner adds **Categories / Items** (products & services with units & price-per-unit).
4. **New Bill** → pick items (most-used first) → edit quantity & switch units (kg↔g auto-price) → add labor charge (editable) → **Checkout** → optional customer name/number/email → **Send** → invoice image shared to WhatsApp (or downloaded).
5. **History** → date filter, search by Order ID/name/number/email, finance stats, resend any bill.

## 7. Daily flow for you (Yasir)

- `/admin` — dashboard with pending requests.
- `/admin/businesses` — approve / reject / suspend shops, view all details. **No revenue tracking by design.**
- `/admin/owners` — every shop-owner account with their shops (read-only).
- `/admin/support` — answer shop owners' questions.
- `/admin/team` — ＋ **Assign New Manager** (you set their email + password; credentials + invite
  message are shown to copy to them) and remove managers again.

## 8. What's wired for later

- **Email confirmation of approvals:** enable "Confirm email" in Supabase Auth settings; the notification trigger table already exists — connect Resend/SendGrid to the `notifications` table for automatic emails.
- **WhatsApp auto-send:** the WhatsApp Business Cloud API can be added server-side later; the invoice image + order ID flow is already API-shaped.
- **SMS:** add MSG91/Twilio later; customer phone is already captured.
