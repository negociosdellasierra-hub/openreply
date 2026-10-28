/**
 * Turns an Instagram webhook payload into the events the ATOM funnel needs.
 * Unlike the campaign parsers, this keeps quick-reply payloads, story replies,
 * image attachments and echoes (to detect a human replying from Instagram).
 */

export type FunnelEvent =
  | {
      type: "comment";
      igId: string;
      commentId: string;
      text: string;
      userId: string;
      username?: string;
    }
  | {
      type: "message";
      igId: string;
      userId: string;
      mid: string;
      text: string;
      /** Payload of a tapped quick reply. */
      quickReply?: string;
      isStoryReply: boolean;
      hasImage: boolean;
    }
  | { type: "postback"; igId: string; userId: string; mid?: string; payload: string }
  | { type: "echo"; igId: string; userId: string; mid: string };

type Messaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  postback?: { mid?: string; payload?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    quick_reply?: { payload?: string };
    reply_to?: { story?: { id?: string; url?: string } };
    attachments?: Array<{ type?: string }>;
  };
};

type Payload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        id?: string;
        text?: string;
        from?: { id?: string; username?: string };
        parent_id?: string;
      };
    }>;
    messaging?: Messaging[];
  }>;
};

export const FUNNEL_PREFIX = "F|";

export function parseFunnelEvents(payload: unknown): FunnelEvent[] {
  const p = payload as Payload;
  const events: FunnelEvent[] = [];
  if (!p || p.object !== "instagram") return events;

  for (const entry of p.entry ?? []) {
    const igId = entry.id;
    if (!igId) continue;

    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue;
      const v = change.value;
      const userId = v?.from?.id;
      // Our own public replies come from the business account and are skipped.
      if (!v?.id || !userId || userId === igId) continue;
      events.push({
        type: "comment",
        igId,
        commentId: v.id,
        text: v.text ?? "",
        userId,
        username: v.from?.username,
      });
    }

    for (const m of entry.messaging ?? []) {
      const sender = m.sender?.id;
      const recipient = m.recipient?.id;

      if (m.postback?.payload && sender && sender !== igId) {
        events.push({ type: "postback", igId, userId: sender, mid: m.postback.mid, payload: m.postback.payload });
        continue;
      }

      const msg = m.message;
      if (!msg?.mid || msg.is_deleted || msg.is_unsupported) continue;

      if (msg.is_echo) {
        // Sent by the business account: the user is the recipient.
        if (recipient && recipient !== igId) events.push({ type: "echo", igId, userId: recipient, mid: msg.mid });
        continue;
      }

      if (!sender || sender === igId) continue;
      events.push({
        type: "message",
        igId,
        userId: sender,
        mid: msg.mid,
        text: (msg.text ?? "").trim(),
        quickReply: msg.quick_reply?.payload,
        isStoryReply: Boolean(msg.reply_to?.story),
        hasImage: (msg.attachments ?? []).some((a) => a.type === "image"),
      });
    }
  }
  return events;
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Whole-word, case and accent insensitive keyword match (ManyChat «contiene»). */
export function containsKeyword(text: string, keywords: string[]): boolean {
  const words = fold(text).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const wanted = new Set(keywords.map(fold));
  return words.some((w) => wanted.has(w));
}
