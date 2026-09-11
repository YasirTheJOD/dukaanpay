import type { Bill, Business } from "./types";
import { unitLabel } from "./units";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Order ID: DDMMYYXXX (XXX = random, unique, not a counter). e.g. 100926435 */
export function generateOrderId(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const xxx = String(Math.floor(100 + Math.random() * 900));
  return `${dd}${mm}${yy}${xxx}`;
}

export function billTotal(b: Bill): number {
  return b.items.reduce((s, l) => s + l.amount, 0) + (b.labor_charge || 0);
}

export function invoiceHTML(bill: Bill, biz: Business): string {
  const lines = bill.items
    .map(
      (l, i) => `
      <tr>
        <td style="text-align:center;vertical-align:top;padding:6px 4px;width:24px">${i + 1}</td>
        <td style="text-align:left;vertical-align:top;padding:6px 4px">${esc(l.name)}<div style="font-size:10px;color:#666;margin-top:2px">${l.qty} ${esc(unitLabel(l.unit))} × ₹${l.rate.toFixed(2)}</div></td>
        <td style="text-align:right;vertical-align:top;padding:6px 4px;white-space:nowrap">₹${l.amount.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const itemsTotal = bill.items.reduce((s, l) => s + l.amount, 0);
  const labor = bill.labor_charge || 0;

  return `
  <div id="invoice" style="width:340px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111;padding:18px 16px;box-sizing:border-box;text-align:left">
    <div style="text-align:center;border-bottom:2px solid #0ea75f;padding-bottom:10px;margin-bottom:10px">
      <div style="font-size:19px;font-weight:bold">${esc(biz.name)}</div>
      <div style="font-size:11px;color:#444;margin-top:2px">${esc(biz.address)}</div>
      <div style="font-size:11px;color:#444">Ph: ${esc(biz.shop_phone)}${biz.shop_email ? " • " + esc(biz.shop_email) : ""}</div>
      <div style="font-size:11px;color:#444">Owner: ${esc(biz.owner_name)}</div>
    </div>

    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px">
      <div>Order ID: <b>${esc(bill.order_id)}</b><br/>${fmtDate(bill.created_at)}</div>
      <div style="text-align:right">Customer: <b>${esc(bill.customer_name || "Walk-in")}</b>${
        bill.customer_phone ? "<br/>" + esc(bill.customer_phone) : ""
      }${bill.customer_email ? "<br/>" + esc(bill.customer_email) : ""}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f0fdf4">
          <th style="text-align:center;padding:6px 4px;border-bottom:1px solid #ddd;width:24px">#</th>
          <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #ddd">Item</th>
          <th style="text-align:right;padding:6px 4px;border-bottom:1px solid #ddd">Amount</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>

    <table style="width:100%;font-size:12px;margin-top:8px;border-collapse:collapse">
      <tr><td style="padding:3px 0;color:#555;text-align:left">Items total</td><td style="text-align:right;white-space:nowrap">₹${itemsTotal.toFixed(2)}</td></tr>
      ${
        labor > 0
          ? `<tr><td style="padding:3px 0;color:#555;text-align:left">Labor / Service charge</td><td style="text-align:right;white-space:nowrap">₹${labor.toFixed(
              2
            )}</td></tr>`
          : ""
      }
      <tr style="font-size:15px;font-weight:bold;border-top:2px solid #111">
        <td style="padding:7px 0;text-align:left">TOTAL</td><td style="text-align:right;white-space:nowrap">₹${billTotal(bill).toFixed(2)}</td>
      </tr>
    </table>

    <div style="margin-top:14px;text-align:center;font-size:11px;color:#666;border-top:1px dashed #bbb;padding-top:8px">
      Thank you for shopping with us! 🙏<br/>Powered by <b>DukaanPay</b>
    </div>
  </div>`;
}
