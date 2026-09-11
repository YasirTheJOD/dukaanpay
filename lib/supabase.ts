import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser client for the web app, native client inside the Capacitor APK.
 *
 * Why two clients: @supabase/ssr keeps the session in COOKIES so the
 * Next.js middleware can read it. The Android WebView does not reliably
 * persist cookies across app restarts, which forced a login on every
 * cold start of the APK. Standard supabase-js stores the session in
 * localStorage, which the WebView DOES persist — so the APK stays signed in.
 *
 * The middleware only guards routes on the Vercel web deployment; the APK
 * is a static shell where those server redirects never run, so switching
 * clients there is safe. The shared PKCE flow and cookies.get in useSession
 * behave the same through supabase-js's own storage layer.
 */
export function createClient(): SupabaseClient {
  if (Capacitor.isNativePlatform()) {
    return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
