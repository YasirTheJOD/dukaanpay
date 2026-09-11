/**
 * Public origin of the deployed web app — used for auth email redirects
 * (e.g. email confirmation) so links never point at localhost in production.
 *
 * Priority: NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL (auto-set by
 * Vercel in production builds) → http://localhost:3000 (local dev).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/+$/, "");
