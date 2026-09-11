"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { SupportTicket, SupportMessage } from "@/lib/types";

export default function AdminSupportPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState("");
  const [myId, setMyId] = useState<string | null>(null);

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    setMyId(auth.user?.id ?? null);
    const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
    setTickets((data as SupportTicket[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTicket = async (id: string) => {
    setOpenId(id);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as SupportMessage[]) ?? []);
  };

  const sendReply = async () => {
    if (!openId || !reply.trim() || !myId) return;
    await supabase.from("support_messages").insert({
      ticket_id: openId,
      sender_id: myId,
      body: reply.trim(),
    });
    await supabase.from("support_tickets").update({ status: "answered", updated_at: new Date().toISOString() }).eq("id", openId);
    setReply("");
    openTicket(openId);
  };

  const closeTicket = async (t: SupportTicket) => {
    await supabase.from("support_tickets").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", t.id);
    load();
  };

  return (
    <div className="space-y-4">
      {openId ? (
        <>
          <button className="text-sm font-semibold text-[#0ea75f]" onClick={() => setOpenId(null)}>
            ← All tickets
          </button>
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className={`card ${m.sender_id === myId ? "ml-16 border-[#0ea75f]" : "mr-16"}`}>
                <div className="text-sm">{m.body}</div>
                <div className="mt-1 text-[10px] text-gray-400">
                  {m.sender_id === myId ? "You (Team)" : "Shop owner"} · {new Date(m.created_at).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
            {messages.length === 0 && <p className="text-center text-sm text-gray-500">No messages.</p>}
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="Type your reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button className="rounded-xl bg-[#0ea75f] px-4 font-bold text-white" onClick={sendReply}>
              Send
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-xl font-extrabold">Support Inbox</h1>
          <div className="space-y-2">
            {tickets.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No tickets yet.</p>}
            {tickets.map((t) => (
              <div key={t.id} className="card flex flex-wrap items-center gap-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => openTicket(t.id)}>
                  <div className="text-sm font-bold">{t.subject}</div>
                  <div className="text-xs text-gray-500">Updated {new Date(t.updated_at).toLocaleString("en-IN")}</div>
                </button>
                <span className={`chip ${t.status === "open" ? "!border-yellow-300 !bg-yellow-50" : ""}`}>{t.status}</span>
                {t.status !== "closed" && (
                  <button className="chip" onClick={() => closeTicket(t)}>
                    Close
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
