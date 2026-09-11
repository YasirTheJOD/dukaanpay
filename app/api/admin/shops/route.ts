import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Business } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/shops — team (owner/manager/staff) only.
 * All shops with their owner account name/phone, for admin lists.
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
    .from("businesses")
    .select("id, name, business_type, status, owner_id, owner_name, owner_phone, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ businesses: (data as Business[]) ?? [] });
}
