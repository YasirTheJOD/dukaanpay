"use client";

import { useBiz } from "@/lib/biz";
import { useNotifications } from "@/lib/hooks";
import { Shell } from "@/components/shell";

export default function NotificationsPage() {
  const { businesses, currentId, setCurrentId } = useBiz();
  const { items, markAllRead } = useNotifications();

  return (
    <Shell title="Notifications" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId} hideNav>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No notifications yet. Shop approval updates will appear here.</p>
        )}
        {items.map((n) => (
          <div key={n.id} className={`card ${!n.read ? "border-[#0ea75f]" : ""}`}>
            <div className="text-sm font-bold">{n.title}</div>
            <div className="text-sm text-gray-600">{n.body}</div>
            <div className="mt-1 text-[10px] text-gray-400">{new Date(n.created_at).toLocaleString("en-IN")}</div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <button className="mt-3 text-sm font-semibold text-[#0ea75f]" onClick={markAllRead}>
          Mark all as read
        </button>
      )}
    </Shell>
  );
}
