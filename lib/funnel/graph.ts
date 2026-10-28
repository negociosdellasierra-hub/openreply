/**
 * Minimal Instagram Messaging calls for the ATOM funnel (direct Meta
 * connections only). Every message id we send is remembered for 3 days so an
 * echo of it is not mistaken for a human replying from the Instagram app.
 */
import { getMetaGraphApiVersion } from "@/lib/env";
import { getRedisConnection } from "@/lib/queue/client";

const base = () => `https://graph.instagram.com/${getMetaGraphApiVersion()}`;

export const MAX_BUTTONS = 3; // button template limit
export const MAX_QUICK_REPLIES = 13;

/** Meta caps button / quick reply titles at 20 characters. Count code points so an emoji is never cut in half. */
export function clipTitle(title: string, max = 20): string {
  const chars = Array.from(title);
  return chars.length <= max ? title : chars.slice(0, max).join("");
}

export class FunnelSendError extends Error {
  constructor(message: string, public code?: number, public subcode?: number) {
    super(message);
    this.name = "FunnelSendError";
  }
}

type Recipient = { id: string } | { comment_id: string };

const sentKey = (mid: string) => `funnel:sent:${mid}`;

export async function wasSentByFunnel(mid: string): Promise<boolean> {
  return (await getRedisConnection().exists(sentKey(mid))) === 1;
}

async function post(
  token: string,
  igId: string,
  recipient: Recipient,
  message: Record<string, unknown>
): Promise<string | undefined> {
  const response = await fetch(`${base()}/${igId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient, message }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    message_id?: string;
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!response.ok || data.error) {
    throw new FunnelSendError(
      `${data.error?.message ?? "Instagram send failed"} [code=${data.error?.code ?? response.status} sub=${data.error?.error_subcode ?? "-"}]`,
      data.error?.code ?? response.status,
      data.error?.error_subcode
    );
  }
  if (data.message_id) {
    await getRedisConnection().set(sentKey(data.message_id), "1", "EX", 3 * 24 * 3600);
  }
  return data.message_id;
}

export function sendText(token: string, igId: string, to: Recipient, text: string) {
  return post(token, igId, to, { text });
}

export function sendQuickReplies(
  token: string,
  igId: string,
  to: Recipient,
  text: string,
  replies: Array<{ title: string; payload: string }>
) {
  return post(token, igId, to, {
    text,
    quick_replies: replies.slice(0, MAX_QUICK_REPLIES).map((r) => ({
      content_type: "text",
      title: clipTitle(r.title),
      payload: r.payload,
    })),
  });
}

export function sendPostbackButtons(
  token: string,
  igId: string,
  to: Recipient,
  text: string,
  buttons: Array<{ title: string; payload: string }>
) {
  return post(token, igId, to, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text.slice(0, 640),
        buttons: buttons.slice(0, MAX_BUTTONS).map((b) => ({
          type: "postback",
          title: clipTitle(b.title),
          payload: b.payload,
        })),
      },
    },
  });
}

export function sendUrlButtons(
  token: string,
  igId: string,
  to: Recipient,
  text: string,
  buttons: Array<{ title: string; url: string }>
) {
  return post(token, igId, to, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text.slice(0, 640),
        buttons: buttons.slice(0, MAX_BUTTONS).map((b) => ({
          type: "web_url",
          title: clipTitle(b.title),
          url: b.url,
        })),
      },
    },
  });
}

/** Audio file by public URL (aac, m4a, wav or mp4; max 25 MB). */
export function sendAudio(token: string, igId: string, to: Recipient, url: string) {
  return post(token, igId, to, { attachment: { type: "audio", payload: { url } } });
}

/** Public reply under a comment. */
export async function replyToComment(token: string, commentId: string, message: string) {
  const response = await fetch(`${base()}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new FunnelSendError(data.error?.message ?? "Comment reply failed", response.status);
  }
}

/** True / false, or null when Instagram does not say. */
export async function followsBusiness(token: string, igsid: string): Promise<boolean | null> {
  try {
    const url = new URL(`${base()}/${igsid}`);
    url.searchParams.set("fields", "is_user_follow_business");
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const data = (await response.json()) as { is_user_follow_business?: unknown };
    return typeof data.is_user_follow_business === "boolean" ? data.is_user_follow_business : null;
  } catch {
    return null;
  }
}

export async function fetchUsername(token: string, igsid: string): Promise<string | null> {
  try {
    const url = new URL(`${base()}/${igsid}`);
    url.searchParams.set("fields", "username");
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const data = (await response.json()) as { username?: unknown };
    return typeof data.username === "string" ? data.username : null;
  } catch {
    return null;
  }
}
