import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createAdminClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/create-manager — Lead Owner only.
 * Body: { email, password, full_name?, phone? }
 * Creates an auth account and immediately sets its profile role to 'manager'.
 * The invite message is composed by the caller (Team page) from the returned
 * credentials. Only managers can be created through this route.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Lead Owner check via RLS-protected profiles table
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((me as { role?: string } | null)?.role !== "owner") {
    return NextResponse.json({ error: "Only the Lead Owner can invite managers." }, { status: 403 });
  }

  const admin = adminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: { email?: string; password?: string; full_name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();
  const phone = (body.phone ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  // Create the auth user (auto-confirmed so they can log in right away)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message ?? "Could not create the account.";
    return NextResponse.json(
      { error: msg.includes("already") ? "An account with this email already exists." : msg },
      { status: 400 }
    );
  }

  // Set the role to manager (create the profile row if the signup trigger hasn't fired yet)
  const { error: roleErr } = await admin
    .from("profiles")
    .upsert({ id: created.user.id, full_name: fullName, phone, role: "manager" });

  if (roleErr) {
    // Roll back the auth account so we don't leave a role-less user behind
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `Account created but role setup failed: ${roleErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    credentials: { email, password },
    profile: { id: created.user.id, full_name: fullName, phone, role: "manager" },
  });
}
