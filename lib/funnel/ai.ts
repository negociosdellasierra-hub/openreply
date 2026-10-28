/**
 * Replacement for ManyChat's «AI Step» in the Default Reply. Uses the
 * Anthropic API when ANTHROPIC_API_KEY is set; without it the funnel stays
 * silent on free text and the conversation is answered by hand.
 */
import { AI_CONTEXT, AI_GOAL, AI_MAX_CHARS, AI_RULES } from "./config";

export type AiTurn = { role: "user" | "assistant"; content: string };

export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function aiReply(history: AiTurn[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || history.length === 0) return null;

  // The API needs alternating turns that start with the user.
  const turns: AiTurn[] = [];
  for (const t of history.slice(-12)) {
    if (turns.length === 0 && t.role !== "user") continue;
    const last = turns[turns.length - 1];
    if (last && last.role === t.role) last.content += `\n${t.content}`;
    else turns.push({ ...t });
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") return null;

  const system = [
    `Objetivo: ${AI_GOAL}`,
    `Contexto: ${AI_CONTEXT}`,
    ...AI_RULES.map((r) => `Regla: ${r}`),
    `Responde en español, en texto plano, en menos de ${AI_MAX_CHARS} caracteres.`,
  ].join("\n\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: 300,
        system,
        messages: turns,
      }),
    });
    if (!response.ok) {
      console.error("[ATOM funnel] AI request failed:", response.status);
      return null;
    }
    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    if (!text) return null;
    return Array.from(text).slice(0, AI_MAX_CHARS).join("");
  } catch (error) {
    console.error("[ATOM funnel] AI request error:", error instanceof Error ? error.message : error);
    return null;
  }
}
