/**
 * ATOM funnel engine: a copy of the ManyChat flows (see config.ts) running on
 * OpenReply's queue. Off unless FUNNEL_ENABLED=true.
 *
 * It needs the Instagram account to be the owner of the conversations
 * (Meta Business Suite → Conversation routing), exactly like ManyChat today.
 */
import { randomUUID } from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import { prisma } from "@/lib/db/client";
import { getBaseUrl } from "@/lib/env";
import { decryptToken } from "@/lib/meta/oauth";
import { getRedisConnection } from "@/lib/queue/client";
import type { FunnelContact, Prisma } from "@/app/generated/prisma/client";
import { aiReply, isAiEnabled, type AiTurn } from "./ai";
import {
  AI_GREETING,
  COMMENT_KEYWORDS,
  COMMENT_OPENINGS,
  DM_KEYWORDS,
  FOLLOW_UPS,
  HUMAN_PAUSE_HOURS,
  NODES,
  PUBLIC_REPLIES,
  SOCIO_IMAGE_MAX_RETRIES,
  SOCIO_IMAGE_RETRY,
  SOCIO_KEYWORDS,
  TAGS,
  type FunnelMessage,
  type NodeId,
} from "./config";
import {
  followsBusiness,
  fetchUsername,
  replyToComment,
  sendAudio,
  sendPostbackButtons,
  sendQuickReplies,
  sendText,
  sendUrlButtons,
  wasSentByFunnel,
} from "./graph";
import { buildTaggedLink } from "./links";
import { containsKeyword, FUNNEL_PREFIX, parseFunnelEvents, type FunnelEvent } from "./parse";

export const FUNNEL_QUEUE = "atom-funnel";

export function isFunnelEnabled(): boolean {
  return process.env.FUNNEL_ENABLED === "true";
}

type EventJob = { kind: "event"; event: FunnelEvent };
// runId "recheck" = delayed second look at the follow gate (Instagram reports new follows late).
type StepJob = { kind: "step"; contactId: string; node: NodeId; runId: string };
type FunnelJob = EventJob | StepJob;

let queue: Queue<FunnelJob> | null = null;
function getFunnelQueue(): Queue<FunnelJob> {
  if (!queue) {
    queue = new Queue<FunnelJob>(FUNNEL_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        // One attempt: a retry could send the same DM twice.
        attempts: 1,
        // Keep finished jobs a day so a late Meta redelivery is still deduplicated.
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 86400 },
      },
    });
  }
  return queue;
}

const safeId = (s: string) => Buffer.from(s).toString("base64url");

/** Called from the webhook for every Instagram payload. */
export async function enqueueFunnelWebhook(payload: unknown): Promise<void> {
  if (!isFunnelEnabled()) return;
  const q = getFunnelQueue();
  for (const event of parseFunnelEvents(payload)) {
    const key =
      event.type === "comment"
        ? `c_${event.commentId}`
        : event.type === "postback"
          ? `p_${safeId(event.mid ?? `${event.userId}${event.payload}${Math.floor(Date.now() / 10_000)}`)}`
          : `m_${safeId(event.mid)}`;
    await q.add("event", { kind: "event", event }, {
      jobId: `funnel_${key}`,
      // Give our own send a moment to be recorded before judging an echo.
      delay: event.type === "echo" ? 15_000 : 0,
    });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

type Contact = FunnelContact;
type Ctx = { token: string; igId: string; contact: Contact; commentId?: string };
type ContactData = { ai?: AiTurn[]; aiGreetedAt?: string; socioRetries?: number; socioHandle?: string; log?: string[] };

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const dataOf = (c: Contact) => (c.data ?? {}) as unknown as ContactData;

async function loadAccount(igId: string) {
  const account = await prisma.instagramAccount.findUnique({ where: { instagramId: igId } });
  if (!account || account.provider !== "META" || !account.accessToken) return null;
  return { token: decryptToken(account.accessToken), igId };
}

async function upsertContact(igId: string, igsid: string, patch: Prisma.FunnelContactUpdateInput = {}) {
  return prisma.funnelContact.upsert({
    where: { instagramAccountId_igsid: { instagramAccountId: igId, igsid } },
    create: {
      ...(patch as Omit<Prisma.FunnelContactCreateInput, "instagramAccountId" | "igsid">),
      instagramAccountId: igId,
      igsid,
    },
    update: patch,
  });
}

async function saveData(ctx: Ctx, data: ContactData, extra: Prisma.FunnelContactUpdateInput = {}) {
  ctx.contact = await prisma.funnelContact.update({
    where: { id: ctx.contact.id },
    data: { data: data as unknown as Prisma.InputJsonValue, ...extra },
  });
}

async function logStep(ctx: Ctx, what: string) {
  const data = dataOf(ctx.contact);
  const log = [...(data.log ?? []), `${new Date().toISOString()} ${what}`].slice(-30);
  await saveData(ctx, { ...data, log });
}

async function reportError(where: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ATOM funnel] ${where}:`, message);
  await prisma.operationalEvent
    .create({ data: { source: "WORKER", level: "ERROR", message: `ATOM funnel ${where}: ${message}`.slice(0, 1000) } })
    .catch(() => undefined);
}

function isPaused(c: Contact): boolean {
  return Boolean(c.pausedUntil && c.pausedUntil.getTime() > Date.now());
}

// ─── sending a node ───────────────────────────────────────────────────────────

async function sendMessage(ctx: Ctx, m: FunnelMessage, useComment: boolean) {
  const to = useComment && ctx.commentId ? { comment_id: ctx.commentId } : { id: ctx.contact.igsid };
  const payload = (go: NodeId) => `${FUNNEL_PREFIX}${go}`;
  switch (m.kind) {
    case "text":
      if (m.quickReplies?.length) {
        return sendQuickReplies(ctx.token, ctx.igId, to, m.text, m.quickReplies.map((q) => ({ title: q.title, payload: payload(q.go) })));
      }
      return sendText(ctx.token, ctx.igId, to, m.text);
    case "buttons":
      return sendPostbackButtons(ctx.token, ctx.igId, to, m.text, m.buttons.map((b) => ({ title: b.title, payload: payload(b.go) })));
    case "links":
      return sendUrlButtons(
        ctx.token,
        ctx.igId,
        to,
        m.text,
        m.links.map((l) => ({ title: l.title, url: l.tag ? buildTaggedLink(ctx.contact.id, l.tag, l.url) : l.url }))
      );
    case "audio":
      try {
        return await sendAudio(ctx.token, ctx.igId, to, `${getBaseUrl()}${m.path}`);
      } catch (error) {
        await reportError("audio", error);
        return undefined;
      }
  }
}

type RunOpts = { fromTap?: boolean; recheck?: boolean };

async function runNode(ctx: Ctx, id: NodeId, depth = 0, opts: RunOpts = {}): Promise<void> {
  if (depth > 5) return;

  if (id === "follow") {
    // «Condición #3»: unknown counts as following, like OpenReply's follow gate.
    const follows = await followsBusiness(ctx.token, ctx.contact.igsid);
    if (follows === false && opts.fromTap && !opts.recheck) {
      // They just tapped «Ya te sigo ✅»: Instagram may not know yet. Look again in 20 s.
      await getFunnelQueue().add(
        "step",
        { kind: "step", contactId: ctx.contact.id, node: "follow", runId: "recheck" },
        { delay: 20_000, jobId: `funnel_recheck_${ctx.contact.id}_${Math.floor(Date.now() / 20_000)}` }
      );
      return;
    }
    return runNode(ctx, follows === false ? "sigueme" : "califica", depth + 1);
  }

  const node = NODES[id];
  const messages = (ctx.contact.source === "dm" && node.messages.dm) || node.messages.default;
  for (const m of messages) await sendMessage(ctx, m, false);

  const extra: Prisma.FunnelContactUpdateInput = {};
  if (node.addTags?.length) extra.tags = Array.from(new Set([...ctx.contact.tags, ...node.addTags]));
  if (node.awaiting !== undefined) extra.awaiting = node.awaiting;
  if (node.startFollowUps) {
    const runId = randomUUID();
    extra.runId = runId;
    const q = getFunnelQueue();
    for (const f of FOLLOW_UPS) {
      await q.add(
        "step",
        { kind: "step", contactId: ctx.contact.id, node: f.node, runId },
        { delay: f.afterHours * 3600_000, jobId: `funnel_fu_${ctx.contact.id}_${runId}_${f.node}` }
      );
    }
  }
  if (Object.keys(extra).length) {
    ctx.contact = await prisma.funnelContact.update({ where: { id: ctx.contact.id }, data: extra });
  }
  await logStep(ctx, id);
  if (node.then) await runNode(ctx, node.then, depth + 1);
}

// ─── event handlers ───────────────────────────────────────────────────────────

async function onComment(e: Extract<FunnelEvent, { type: "comment" }>) {
  if (!containsKeyword(e.text, COMMENT_KEYWORDS)) return;
  const acc = await loadAccount(e.igId);
  if (!acc) return;
  const contact = await upsertContact(e.igId, e.userId, {
    source: "comment",
    ...(e.username ? { username: e.username } : {}),
  });
  if (isPaused(contact)) return;
  const ctx: Ctx = { ...acc, contact, commentId: e.commentId };

  try {
    await replyToComment(acc.token, e.commentId, pick(PUBLIC_REPLIES));
  } catch (error) {
    await reportError("public reply", error);
  }
  // «Aleatorizador» A / B / C as the private reply to the comment.
  await sendMessage(ctx, { kind: "text", text: pick(COMMENT_OPENINGS) }, true);
  await logStep(ctx, "apertura_comentario");
}

async function onMessage(e: Extract<FunnelEvent, { type: "message" }>) {
  const acc = await loadAccount(e.igId);
  if (!acc) return;
  let contact = await upsertContact(e.igId, e.userId, { lastUserAt: new Date() });
  if (!contact.username) {
    const username = await fetchUsername(acc.token, e.userId);
    if (username) contact = await prisma.funnelContact.update({ where: { id: contact.id }, data: { username } });
  }
  if (isPaused(contact)) return;
  const ctx: Ctx = { ...acc, contact };

  // Quick reply tapped.
  if (e.quickReply?.startsWith(FUNNEL_PREFIX)) {
    const node = e.quickReply.slice(FUNNEL_PREFIX.length) as NodeId;
    if (node in NODES || node === "follow") {
      if (contact.awaiting) ctx.contact = await prisma.funnelContact.update({ where: { id: contact.id }, data: { awaiting: null } });
      return runNode(ctx, node, 0, { fromTap: true });
    }
  }

  // Waiting for the socio screenshot.
  if (contact.awaiting === "socio_img") {
    const data = dataOf(contact);
    if (e.hasImage) {
      await saveData(ctx, { ...data, socioRetries: 0 }, { awaiting: null });
      return runNode(ctx, "socio_handle");
    }
    const retries = (data.socioRetries ?? 0) + 1;
    if (retries >= SOCIO_IMAGE_MAX_RETRIES) {
      await saveData(ctx, { ...data, socioRetries: 0 }, { awaiting: null });
      return runNode(ctx, "socio_handle");
    }
    await saveData(ctx, { ...data, socioRetries: retries });
    await sendMessage(ctx, { kind: "text", text: SOCIO_IMAGE_RETRY, quickReplies: [{ title: "Omitir", go: "socio_skip" }] }, false);
    return;
  }

  // Waiting for the @ of the socio's account.
  if (contact.awaiting === "socio_handle" && e.text) {
    await saveData(ctx, { ...dataOf(contact), socioHandle: e.text.slice(0, 100) }, { awaiting: null });
    return runNode(ctx, "socio_done");
  }

  if (!e.text) return;

  // «Socios (story SOCIO)»: reply to a story with SOCIO / SOCIOS.
  if (e.isStoryReply && containsKeyword(e.text, SOCIO_KEYWORDS)) return runNode(ctx, "socio_q");

  // «Ventas DM e historias v3»: DM or story reply with ATOM.
  if (containsKeyword(e.text, DM_KEYWORDS)) {
    ctx.contact = await prisma.funnelContact.update({ where: { id: contact.id }, data: { source: "dm" } });
    return runNode(ctx, "open_dm");
  }

  // «Default Reply» → «Continuar si responde con texto» for commenters.
  if (contact.source === "comment" && !contact.tags.includes(TAGS.califica)) return runNode(ctx, "continuar");

  // «Default Reply» → AI step.
  if (!isAiEnabled()) return;
  const data = dataOf(contact);
  const history: AiTurn[] = [...(data.ai ?? []), { role: "user" as const, content: e.text }].slice(-12);
  const greetedAt = data.aiGreetedAt ? Date.parse(data.aiGreetedAt) : 0;
  let aiGreetedAt = data.aiGreetedAt;
  if (Date.now() - greetedAt > 24 * 3600_000) {
    await sendText(acc.token, e.igId, { id: e.userId }, AI_GREETING);
    aiGreetedAt = new Date().toISOString();
  }
  const answer = await aiReply(history);
  if (answer) {
    await sendText(acc.token, e.igId, { id: e.userId }, answer);
    history.push({ role: "assistant", content: answer });
  }
  await saveData(ctx, { ...data, ai: history.slice(-12), aiGreetedAt });
}

async function onPostback(e: Extract<FunnelEvent, { type: "postback" }>) {
  if (!e.payload.startsWith(FUNNEL_PREFIX)) return; // campaign buttons are OpenReply's
  const node = e.payload.slice(FUNNEL_PREFIX.length) as NodeId;
  if (!(node in NODES)) return;
  const acc = await loadAccount(e.igId);
  if (!acc) return;
  let contact = await upsertContact(e.igId, e.userId, { lastUserAt: new Date() });
  if (isPaused(contact)) return;
  if (contact.awaiting) {
    contact = await prisma.funnelContact.update({ where: { id: contact.id }, data: { awaiting: null } });
  }
  await runNode({ ...acc, contact }, node, 0, { fromTap: true });
}

async function onEcho(e: Extract<FunnelEvent, { type: "echo" }>) {
  if (await wasSentByFunnel(e.mid)) return;
  // A person answered from Instagram or the inbox: pause the bot for this contact.
  const contact = await prisma.funnelContact.findUnique({
    where: { instagramAccountId_igsid: { instagramAccountId: e.igId, igsid: e.userId } },
  });
  if (!contact) return;
  await prisma.funnelContact.update({
    where: { id: contact.id },
    data: { pausedUntil: new Date(Date.now() + HUMAN_PAUSE_HOURS * 3600_000) },
  });
}

async function onStep(job: StepJob) {
  const contact = await prisma.funnelContact.findUnique({ where: { id: job.contactId } });
  if (!contact || isPaused(contact)) return;
  if (job.runId === "recheck") {
    const acc = await loadAccount(contact.instagramAccountId);
    if (acc) await runNode({ ...acc, contact }, "follow", 0, { fromTap: true, recheck: true });
    return;
  }
  if (contact.runId !== job.runId) return;
  const rule = FOLLOW_UPS.find((f) => f.node === job.node);
  if (rule?.skipIfTags.some((t) => contact.tags.includes(t))) return;
  const acc = await loadAccount(contact.instagramAccountId);
  if (!acc) return;
  await runNode({ ...acc, contact }, job.node);
}

async function processFunnelJob(job: Job<FunnelJob>) {
  const data = job.data;
  try {
    if (data.kind === "step") return await onStep(data);
    const e = data.event;
    if (e.type === "comment") return await onComment(e);
    if (e.type === "message") return await onMessage(e);
    if (e.type === "postback") return await onPostback(e);
    if (e.type === "echo") return await onEcho(e);
  } catch (error) {
    await reportError(data.kind === "step" ? `step ${data.node}` : `event ${data.event.type}`, error);
  }
}

export function createFunnelWorker(): Worker<FunnelJob> | null {
  if (!isFunnelEnabled()) {
    console.log("[ATOM funnel] Off (FUNNEL_ENABLED is not true)");
    return null;
  }
  console.log("[ATOM funnel] Started");
  const worker = new Worker<FunnelJob>(FUNNEL_QUEUE, processFunnelJob, {
    connection: getRedisConnection(),
    // One job at a time: two messages from the same person can never race
    // and send a step twice. Volume is low, so this is fast enough.
    concurrency: 1,
    // A crashed job is not retried: a retry could send the same DM twice.
    maxStalledCount: 0,
  });
  worker.on("error", (err) => console.error("[ATOM funnel] worker error:", err.message));
  worker.on("failed", (job, err) => console.error(`[ATOM funnel] job ${job?.id} failed:`, err.message));
  return worker;
}
