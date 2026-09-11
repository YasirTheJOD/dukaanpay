"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import type { AppNotification, Profile } from "@/lib/types";

export function useSession() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    let latest: string | null = null;
    let latestId: string | null = null;
    const apply = () => {
      if (!mounted) return;
      setEmail(latest);
      setUserId(latestId);
    };
    // Await the stored session (localStorage in the APK, cookies on web) so a
    // restored session isn't reported as signed-out while it's still loading.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        latest = data.session?.user.email ?? null;
        latestId = data.session?.user.id ?? null;
        apply();
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    // Keep state in sync when the session appears, refreshes, or is replaced.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") return; // handled by getSession() above
      latest = s?.user.email ?? null;
      latestId = s?.user.id ?? null;
      apply();
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, email, userId };
}

export function useProfile() {
  const { userId, loading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setProfileLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        setProfile((data as Profile) ?? null);
        setProfileLoading(false);
      });
  }, [userId, loading]);

  return { profile, profileLoading };
}

/*
 * Realtime notifications channel.
 *
 * supabase-js THROWS "cannot add `postgres_changes` callbacks for realtime
 * <channel> after `subscribe()`" when `.on()` is called on a channel that has
 * already been subscribed — which happens easily when two components mount
 * this hook (page + Shell bell) or React re-mounts with the same channel name.
 *
 * Fix: keep ONE shared channel per logged-in user in module scope and fan
 * inserts out to every mounted subscriber through a handler set.
 */
let notifChannel: RealtimeChannel | null = null;
let notifChannelUserId: string | null = null;
let notifChannelSeq = 0;
const notifHandlers = new Set<(n: AppNotification) => void>();

function ensureNotificationsChannel(userId: string): void {
  if (notifChannel && notifChannelUserId === userId) return;
  const supabase = createClient();
  if (notifChannel) supabase.removeChannel(notifChannel);
  notifHandlers.clear();
  notifChannel = supabase
    .channel(`notifications-${userId}-${++notifChannelSeq}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = payload.new as AppNotification;
        notifHandlers.forEach((handler) => handler(n));
      }
    )
    .subscribe();
  notifChannelUserId = userId;
}

export function useNotifications() {
  const { userId } = useSession();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const list = (data as AppNotification[]) ?? [];
        setItems(list);
        setUnread(list.filter((n) => !n.read).length);
      });

    ensureNotificationsChannel(userId);
    const handler = (n: AppNotification) => {
      setItems((prev) => [n, ...prev]);
      setUnread((u) => u + 1);
    };
    notifHandlers.add(handler);

    return () => {
      notifHandlers.delete(handler);
      // Last mounted consumer unmounted → tear the channel down cleanly.
      if (notifHandlers.size === 0 && notifChannel && notifChannelUserId === userId) {
        supabase.removeChannel(notifChannel);
        notifChannel = null;
        notifChannelUserId = null;
      }
    };
  }, [userId]);

  const markAllRead = async () => {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return { items, unread, markAllRead };
}
