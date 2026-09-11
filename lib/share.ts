"use client";

import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import type { Bill } from "./types";

function fileNameFor(bill: Bill): string {
  return `DukaanPay-${bill.order_id}.png`;
}

/** True inside the Capacitor Android/iOS shell (no Web Share API / downloads there). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Render the offscreen invoice node to a PNG blob. */
export async function invoiceNodeToBlob(node: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(node, {
    scale: 2.5,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Invoice render failed"));
    }, "image/png");
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1)); // strip the data: URL prefix
    };
    reader.onerror = () => reject(new Error("Could not read the invoice image"));
    reader.readAsDataURL(blob);
  });
}

export function shareCancelledError(e: unknown): boolean {
  const err = e as { name?: string; message?: string };
  return err?.name === "AbortError" || /cancel/i.test(err?.message ?? "");
}

/**
 * Native Android path: render → save PNG into the app cache → hand the file
 * to the system share sheet (WhatsApp included). Directory.Cache is already
 * whitelisted for the FileProvider in android/app/src/main/res/xml/file_paths.xml,
 * so no storage permission is needed.
 */
async function shareInvoiceNative(
  node: HTMLElement,
  bill: Bill,
  customerName?: string | null
): Promise<"shared" | "downloaded"> {
  const blob = await invoiceNodeToBlob(node);
  const base64 = await blobToBase64(blob);
  const fileName = fileNameFor(bill);

  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  const text = `Hello${customerName ? " " + customerName : ""}, here is your bill from the shop. Order ID: ${bill.order_id}`;

  const { value: canShare } = await Share.canShare();
  if (!canShare) {
    // Extremely rare on Android — the file is at least saved in the app cache.
    return "downloaded";
  }

  try {
    await Share.share({
      title: `Bill ${bill.order_id}`,
      text,
      dialogTitle: "Share invoice",
      files: [uri],
    });
    return "shared";
  } catch (e) {
    if (shareCancelledError(e)) {
      // User backed out of the share sheet — not an error, don't fall through to download.
      return "shared";
    }
    throw e;
  }
}

/** Web fallback: download the PNG so the owner can attach it manually. */
async function downloadInvoiceWeb(blob: Blob, bill: Bill): Promise<"downloaded"> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(bill);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}

/**
 * Smart share:
 *  - APK → native share sheet with the PNG file (WhatsApp, Gmail, etc.).
 *  - Web → Web Share API when the browser supports files, otherwise download.
 * Resolves with what happened; only throws on real failures (never on cancel).
 */
export async function shareInvoice(
  node: HTMLElement,
  bill: Bill,
  customerName?: string | null
): Promise<"shared" | "downloaded"> {
  if (isNativeApp()) {
    return shareInvoiceNative(node, bill, customerName);
  }

  const blob = await invoiceNodeToBlob(node);
  const file = new File([blob], fileNameFor(bill), { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>;
  };

  const text = `Hello${customerName ? " " + customerName : ""}, here is your bill from the shop. Order ID: ${bill.order_id}`;

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: `Bill ${bill.order_id}` });
      return "shared";
    } catch (e) {
      if (shareCancelledError(e)) {
        // User cancelled the share sheet — don't trigger a download.
        return "shared";
      }
      throw e;
    }
  }

  return downloadInvoiceWeb(blob, bill);
}

/** Open WhatsApp chat with prefilled text (invoice image is attached from the share sheet). */
export function openWhatsApp(phone: string | null | undefined, bill: Bill) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const num = digits.length === 10 ? `91${digits}` : digits;
  const text = encodeURIComponent(
    `Hello, here is your bill (Order ID: ${bill.order_id}). The invoice image is attached — DukaanPay`
  );
  const url = num
    ? `https://wa.me/${num}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}
