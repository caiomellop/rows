import "server-only";

import { LOGIN_LINK_TTL_MINUTES } from "@/lib/login-token";

/**
 * Transactional email through Resend's HTTP API. This file is the only place
 * that knows the provider: swapping it means rewriting `send` and nothing else.
 *
 * Env: RESEND_API_KEY, and EMAIL_FROM (a sender on a domain verified in Resend,
 * with SPF, DKIM and DMARC set up).
 */

const FROM = process.env.EMAIL_FROM ?? "Rows <noreply@rows.so>";

type Message = { to: string; subject: string; text: string; html: string };

async function send(message: Message): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set: cannot send email");
    }
    // Local development without a provider: print the message instead.
    console.info(`[email] to ${message.to}: ${message.subject}\n${message.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!res.ok) {
    throw new Error(`Email provider answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function loginEmail(link: string): Omit<Message, "to"> {
  const validity = `This link is valid for ${LOGIN_LINK_TTL_MINUTES} minutes and works once.`;
  const ignore = "If you didn't ask for it, you can ignore this email.";
  return {
    subject: "Your link to log in to Rows",
    text: `Log in to Rows:\n\n${link}\n\n${validity}\n${ignore}\n`,
    html: `<p>Log in to Rows:</p><p><a href="${escapeHtml(link)}">Log in to Rows</a></p><p>${validity}<br>${ignore}</p>`,
  };
}

export function sendLoginEmail(to: string, link: string): Promise<void> {
  return send({ to, ...loginEmail(link) });
}
