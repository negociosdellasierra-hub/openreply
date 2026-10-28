/**
 * ATOM funnel contacts: who is in the funnel, their tags, and a way to add or
 * remove tags by hand (e.g. mark a buyer with compro_atom), like ManyChat.
 */
import { revalidatePath } from "next/cache";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { TAGS } from "@/lib/funnel/config";

export const dynamic = "force-dynamic";

const ALL_TAGS = Object.values(TAGS) as string[];

async function workspaceIgIds(): Promise<string[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];
  const accounts = await prisma.instagramAccount.findMany({
    where: { workspaceId },
    select: { instagramId: true },
  });
  return accounts.map((a) => a.instagramId);
}

async function toggleTag(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const tag = String(formData.get("tag") ?? "").trim();
  if (!id || !tag || tag.length > 40) return;
  const igIds = await workspaceIgIds();
  const contact = await prisma.funnelContact.findFirst({
    where: { id, instagramAccountId: { in: igIds } },
  });
  if (!contact) return;
  const tags = contact.tags.includes(tag)
    ? contact.tags.filter((t) => t !== tag)
    : [...contact.tags, tag];
  await prisma.funnelContact.update({ where: { id }, data: { tags } });
  revalidatePath("/atom");
}

async function unpause(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const igIds = await workspaceIgIds();
  await prisma.funnelContact.updateMany({
    where: { id, instagramAccountId: { in: igIds } },
    data: { pausedUntil: null },
  });
  revalidatePath("/atom");
}

type Props = { searchParams: Promise<{ q?: string; tag?: string }> };

export default async function AtomFunnelPage({ searchParams }: Props) {
  const { q, tag } = await searchParams;
  const igIds = await workspaceIgIds();
  const contacts = await prisma.funnelContact.findMany({
    where: {
      instagramAccountId: { in: igIds },
      ...(q ? { username: { contains: q, mode: "insensitive" as const } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const total = await prisma.funnelContact.count({ where: { instagramAccountId: { in: igIds } } });
  const enabled = process.env.FUNNEL_ENABLED === "true";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Embudo ATOM</h1>
        <p className="text-sm opacity-70">
          {enabled ? "Encendido" : "Apagado (FUNNEL_ENABLED no está en true)"} · {total} contactos
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar @usuario" className="rounded border px-3 py-2 text-sm" />
        <select name="tag" defaultValue={tag ?? ""} className="rounded border px-3 py-2 text-sm">
          <option value="">Todas las etiquetas</option>
          {ALL_TAGS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button className="rounded border px-3 py-2 text-sm" type="submit">Filtrar</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="py-2 pr-4">Usuario</th>
              <th className="py-2 pr-4">Origen</th>
              <th className="py-2 pr-4">Etiquetas</th>
              <th className="py-2 pr-4">Último paso</th>
              <th className="py-2 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const data = (c.data ?? {}) as unknown as { log?: string[]; socioHandle?: string };
              const last = data.log?.[data.log.length - 1];
              const paused = c.pausedUntil && c.pausedUntil.getTime() > Date.now();
              return (
                <tr key={c.id} className="border-t align-top">
                  <td className="py-2 pr-4">
                    {c.username ? `@${c.username}` : c.igsid}
                    {data.socioHandle ? <div className="opacity-70">socio: {data.socioHandle}</div> : null}
                  </td>
                  <td className="py-2 pr-4">{c.source ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {ALL_TAGS.map((t) => (
                        <form key={t} action={toggleTag}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="tag" value={t} />
                          <button
                            type="submit"
                            className={`rounded px-2 py-0.5 text-xs border ${c.tags.includes(t) ? "bg-black text-white dark:bg-white dark:text-black" : "opacity-50"}`}
                          >
                            {t}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{last ? last.slice(11, 16) + " " + last.slice(25) : "—"}</td>
                  <td className="py-2 pr-4">
                    {paused ? (
                      <form action={unpause}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="text-xs underline">Pausado (respondiste tú) · reanudar</button>
                      </form>
                    ) : (
                      "Activo"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
