import type { Transporter } from "nodemailer";

// Mail transport for the daily digest (E6-S3). Mirrors the photo-storage gate in
// lib/uploads.ts: the feature turns on only when its config is present, and stays
// silent (never throws) otherwise — so an unconfigured pilot degrades gracefully
// and the in-app dashboard remains the authoritative view.

// Whether a relay is configured. Host + credentials are the minimum; without them
// the digest cron skips cleanly instead of erroring.
export function mailEnabled(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

export type Mail = { to: string; subject: string; html: string; text?: string };

// A lazily-built singleton transporter (nodemailer is imported on first use so
// it never loads at build/import time, matching the lazy DB client).
const g = globalThis as unknown as { __mmsMailer?: Transporter };

async function transporter(): Promise<Transporter> {
  if (g.__mmsMailer) return g.__mmsMailer;
  const { createTransport } = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT) || 587;
  g.__mmsMailer = createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return g.__mmsMailer;
}

// Best-effort send: true on success; on any relay failure it logs and returns
// false. Never throws — the caller is a cron that must not fail the whole run
// because one message bounced (the next daily run simply tries again).
export async function sendMail(msg: Mail): Promise<boolean> {
  if (!mailEnabled()) return false;
  try {
    const t = await transporter();
    await t.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return true;
  } catch (e) {
    console.error("[digest] mail send failed:", e);
    return false;
  }
}
