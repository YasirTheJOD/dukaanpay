"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useSession } from "@/lib/hooks";
import type { Business } from "@/lib/types";

interface BizCtx {
  businesses: Business[];
  current: Business | null;
  currentId: string | null;
  setCurrentId: (id: string) => void;
  reload: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<BizCtx>({
  businesses: [],
  current: null,
  currentId: null,
  setCurrentId: () => {},
  reload: async () => {},
  loading: true,
});

const LS_KEY = "dp_active_business";

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useSession();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (data as Business[]) ?? [];
    setBusinesses(list);
    setLoading(false);
    setCurrentIdState((prev) => {
      if (prev && list.some((b) => b.id === prev)) return prev;
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
      if (stored && list.some((b) => b.id === stored)) return stored;
      const firstApproved = list.find((b) => b.status === "approved") ?? list[0];
      return firstApproved?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (userId) reload();
    else setLoading(false);
  }, [userId, reload]);

  const setCurrentId = useCallback((id: string) => {
    setCurrentIdState(id);
    try {
      window.localStorage.setItem(LS_KEY, id);
    } catch {}
  }, []);

  const current = businesses.find((b) => b.id === currentId) ?? null;

  return (
    <Ctx.Provider value={{ businesses, current, currentId, setCurrentId, reload, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useBiz = () => useContext(Ctx);

/** Upload a data-URL/file to Supabase Storage and return the public URL. */
export async function uploadImage(file: File, folder: string): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) return null;
  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return data.publicUrl;
}
