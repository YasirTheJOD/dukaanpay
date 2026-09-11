import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

interface OwnerRow extends Profile {
  businesses: { count: number }[];
}

/**
 * GET /api/admin/owners — team (owner/manager) only.
 * Lists ordinary shop-owner accounts (role 'user') separately from the team,
 * with the number of shops each owns. Team accounts are never included.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const myRole = (me as { role?: string } | null)?.role;
  if (myRole !== "owner" && myRole !== "manager" && myRole !== "staff") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at, businesses(count)")
    .eq("role", "user")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const owners = ((data as unknown as OwnerRow[]) ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    phone: r.phone,
    created_at: r.created_at,
    shops: r.businesses?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ owners });
}
