import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queue/client", () => ({ getRedisConnection: () => ({}) }));

import { NODES, FOLLOW_UPS, COMMENT_OPENINGS, PUBLIC_REPLIES, type NodeId } from "@/lib/funnel/config";
import { containsKeyword, parseFunnelEvents } from "@/lib/funnel/parse";
import { clipTitle } from "@/lib/funnel/graph";
import { buildTaggedLink, readTaggedLink } from "@/lib/funnel/links";

const codePoints = (s: string) => Array.from(s).length;

describe("ATOM funnel config", () => {
  const ids = Object.keys(NODES) as NodeId[];

  it("every button and quick reply points at an existing node", () => {
    for (const id of ids) {
      const node = NODES[id];
      for (const list of [node.messages.default, node.messages.dm ?? []]) {
        for (const m of list) {
          const targets =
            m.kind === "buttons" ? m.buttons.map((b) => b.go) : m.kind === "text" ? (m.quickReplies ?? []).map((q) => q.go) : [];
          for (const t of targets) expect(ids).toContain(t);
        }
      }
      if (node.then) expect(ids).toContain(node.then);
    }
    for (const f of FOLLOW_UPS) expect(ids).toContain(f.node);
  });

  it("respects Instagram limits", () => {
    for (const id of ids) {
      for (const m of [...NODES[id].messages.default, ...(NODES[id].messages.dm ?? [])]) {
        if (m.kind === "buttons") {
          expect(m.buttons.length).toBeLessThanOrEqual(3);
          expect(m.text.length).toBeLessThanOrEqual(640);
          for (const b of m.buttons) expect(codePoints(b.title)).toBeLessThanOrEqual(20);
        }
        if (m.kind === "links") {
          expect(m.links.length).toBeLessThanOrEqual(3);
          expect(m.text.length).toBeLessThanOrEqual(640);
          for (const l of m.links) expect(codePoints(l.title)).toBeLessThanOrEqual(20);
        }
        if (m.kind === "text") {
          expect(m.text.length).toBeLessThanOrEqual(1000);
          for (const q of m.quickReplies ?? []) expect(codePoints(q.title)).toBeLessThanOrEqual(20);
        }
      }
    }
    expect(COMMENT_OPENINGS).toHaveLength(3);
    expect(PUBLIC_REPLIES).toHaveLength(3);
  });
});

describe("containsKeyword", () => {
  it("matches ManyChat variants ignoring case and accents", () => {
    expect(containsKeyword("atom", ["ATOM"])).toBe(true);
    expect(containsKeyword("Quiero ATOM!!", ["ATOM"])).toBe(true);
    expect(containsKeyword("átomo porfa", ["Atomo"])).toBe(true);
    expect(containsKeyword("atomic", ["ATOM"])).toBe(false);
    expect(containsKeyword("hola", ["ATOM"])).toBe(false);
  });
});

describe("clipTitle", () => {
  it("never cuts an emoji in half", () => {
    expect(clipTitle("Solo tengo celular 📱")).toBe("Solo tengo celular 📱");
    expect(codePoints(clipTitle("x".repeat(30)))).toBe(20);
  });
});

describe("parseFunnelEvents", () => {
  const igId = "17841428711864978";

  it("reads comments, quick replies, story replies, images, postbacks and echoes", () => {
    const events = parseFunnelEvents({
      object: "instagram",
      entry: [
        {
          id: igId,
          changes: [
            { field: "comments", value: { id: "c1", text: "ATOM", from: { id: "u1", username: "ana" } } },
            { field: "comments", value: { id: "c2", text: "te dejé un DM", from: { id: igId } } },
          ],
          messaging: [
            { sender: { id: "u1" }, recipient: { id: igId }, message: { mid: "m1", text: "El precio", quick_reply: { payload: "F|precio" } } },
            { sender: { id: "u2" }, recipient: { id: igId }, message: { mid: "m2", text: "SOCIO", reply_to: { story: { id: "s1" } } } },
            { sender: { id: "u3" }, recipient: { id: igId }, message: { mid: "m3", attachments: [{ type: "image" }] } },
            { sender: { id: "u1" }, recipient: { id: igId }, postback: { mid: "p1", payload: "F|follow" } },
            { sender: { id: igId }, recipient: { id: "u1" }, message: { mid: "m4", text: "hola", is_echo: true } },
          ],
        },
      ],
    });
    expect(events).toEqual([
      { type: "comment", igId, commentId: "c1", text: "ATOM", userId: "u1", username: "ana" },
      { type: "message", igId, userId: "u1", mid: "m1", text: "El precio", quickReply: "F|precio", isStoryReply: false, hasImage: false },
      { type: "message", igId, userId: "u2", mid: "m2", text: "SOCIO", quickReply: undefined, isStoryReply: true, hasImage: false },
      { type: "message", igId, userId: "u3", mid: "m3", text: "", quickReply: undefined, isStoryReply: false, hasImage: true },
      { type: "postback", igId, userId: "u1", mid: "p1", payload: "F|follow" },
      { type: "echo", igId, userId: "u1", mid: "m4" },
    ]);
  });
});

describe("tagged links", () => {
  it("round-trips and rejects tampering", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "https://example.vercel.app";
    const url = buildTaggedLink("contact1", "socio_interesado", "https://calendly.com/x");
    const token = url.split("/api/funnel/go/")[1];
    expect(readTaggedLink(token)).toEqual({ contactId: "contact1", tag: "socio_interesado", url: "https://calendly.com/x" });
    expect(readTaggedLink(token.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
  });
});
