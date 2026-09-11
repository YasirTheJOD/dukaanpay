/**
 * build:apk — static export for the Capacitor Android build.
 *
 * The APK is a static shell (webDir: "out"), so Next.js API route handlers
 * (app/api/**) cannot be included in `output: "export"`. They are also useless
 * inside the APK — there is no Node server. This script temporarily moves
 * app/api out of the build, runs the static export, then always restores it.
 *
 * The stash lives OUTSIDE app/ (at .apk-stash/) because the App Router scans
 * every directory under app/ — an in-place rename would still be compiled.
 * The .next cache is cleared first so no stale compiled routes leak through.
 * It also recovers automatically if a previous run was interrupted mid-build.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "app", "api");
const stashRoot = path.join(root, ".apk-stash");
const stashDir = path.join(stashRoot, "api");

// Recover from a previous interrupted run (e.g. Ctrl+C during the build).
if (existsSync(stashDir) && !existsSync(apiDir)) {
  renameSync(stashDir, apiDir);
  console.log("[build:apk] Restored app/api left behind by a previous interrupted build.");
}
if (existsSync(stashDir) && existsSync(apiDir)) {
  console.error(
    "[build:apk] Both app/api and .apk-stash/api exist — resolve this manually, then re-run."
  );
  process.exit(1);
}

mkdirSync(stashRoot, { recursive: true });
renameSync(apiDir, stashDir);
console.log("[build:apk] Temporarily moved app/api aside (server routes can't run inside the APK).");

let status = 1;
try {
  rmSync(path.join(root, ".next"), { recursive: true, force: true });
  const result = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, BUILD_TARGET: "capacitor" },
  });
  status = result.status ?? 1;
} finally {
  if (existsSync(stashDir)) {
    renameSync(stashDir, apiDir);
  }
  if (existsSync(stashRoot) && !existsSync(stashDir)) {
    rmSync(stashRoot, { recursive: true, force: true });
  }
  console.log("[build:apk] Restored app/api.");
}

if (status === 0) {
  console.log("[build:apk] Static export ready in ./out — next: npx cap sync android");
} else {
  console.error("[build:apk] Static export failed.");
}
process.exit(status);
