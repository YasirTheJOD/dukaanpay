"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useBiz } from "@/lib/biz";
import { Shell } from "@/components/shell";
import type { SupportTicket, SupportMessage } from "@/lib/types";

export default function SupportPage() {
  const { businesses, currentId, setCurrentId } = useBiz();
  const supabase = createClient();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [myId, setMyId] = useState<string | null>(null);

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    setMyId(auth.user?.id ?? null);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false });
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

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    const { data } = await supabase
      .from("support_tickets")
      .insert({ subject: subject.trim(), business_id: currentId })
      .select()
      .single();
    if (data) {
      await supabase.from("support_messages").insert({
        ticket_id: (data as SupportTicket).id,
        sender_id: myId!,
        body: body.trim() || "(no message body)",
      });
      setSubject("");
      setBody("");
      load();
    }
  };

  const sendReply = async () => {
    if (!openId || !reply.trim() || !myId) return;
    await supabase.from("support_messages").insert({
      ticket_id: openId,
      sender_id: myId,
      body: reply.trim(),
    });
    await supabase.from("support_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", openId);
    setReply("");
    openTicket(openId);
  };

  return (
    <Shell title="Support" businesses={businesses} currentBusinessId={currentId} onBusinessChange={setCurrentId} hideNav>
      {openId ? (
        <>
          <button className="mb-3 text-sm font-semibold text-[#0ea75f]" onClick={() => setOpenId(null)}>
            ← All conversations
          </button>
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className={`card ${m.sender_id === myId ? "ml-8 border-[#0ea75f]" : "mr-8"}`}>
                <div className="text-sm">{m.body}</div>
                <div className="mt-1 text-[10px] text-gray-400">
                  {m.sender_id === myId ? "You" : "DukaanPay Team"} · {new Date(m.created_at).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
            {messages.length === 0 && <p className="text-center text-sm text-gray-500">No messages yet.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input" placeholder="Type your message…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button className="rounded-xl bg-[#0ea75f] px-4 font-bold text-white" onClick={sendReply}>
              Send
            </button>
          </div>
        </>
      ) : (
        <>
          <form onSubmit={createTicket} className="card space-y-2">
            <h2 className="font-bold">💬 Need help?</h2>
            <input className="input" required placeholder="Subject — e.g. How do I add labor charge?" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <textarea className="input" rows={3} placeholder="Describe your question or problem…" value={body} onChange={(e) => setBody(e.target.value)} />
            <button className="btn-primary">Send to DukaanPay Team</button>
          </form>

          <div className="mt-4 space-y-2">
            {tickets.length === 0 && <p className="text-center text-sm text-gray-500">No conversations yet.</p>}
            {tickets.map((t) => (
              <button key={t.id} className="card flex w-full items-center justify-between !py-3 text-left" onClick={() => openTicket(t.id)}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{t.subject}</div>
                  <div className="text-xs text-gray-500">{new Date(t.updated_at).toLocaleString("en-IN")}</div>
                </div>
                <span className={`chip ${t.status === "open" ? "!border-yellow-300 !bg-yellow-50" : ""}`}>{t.status}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
