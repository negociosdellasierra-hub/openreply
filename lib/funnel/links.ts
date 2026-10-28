/**
 * Signed redirect links: tapping the button tags the contact (like ManyChat's
 * «al hacer clic, añadir etiqueta») and then opens the real URL.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { getBaseUrl } from "@/lib/env";

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is required for funnel links");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url").slice(0, 22);

export function buildTaggedLink(contactId: string, tag: string, url: string): string {
  const body = Buffer.from(JSON.stringify({ c: contactId, t: tag, u: url })).toString("base64url");
  return `${getBaseUrl()}/api/funnel/go/${body}.${sign(body)}`;
}

export function readTaggedLink(token: string): { contactId: string; tag: string; url: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { c?: string; t?: string; u?: string };
    if (!data.c || !data.t || !data.u || !/^https:\/\//.test(data.u)) return null;
    return { contactId: data.c, tag: data.t, url: data.u };
  } catch {
    return null;
  }
}
