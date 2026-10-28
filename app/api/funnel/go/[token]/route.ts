import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { readTaggedLink } from "@/lib/funnel/links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

// ATOM funnel button: tag the contact (e.g. socio_interesado) and open the real URL.
export async function GET(request: NextRequest, { params }: Props) {
  const { token } = await params;
  const link = readTaggedLink(token);
  if (!link) return NextResponse.redirect(new URL("/", request.url), { status: 302 });

  try {
    const contact = await prisma.funnelContact.findUnique({ where: { id: link.contactId } });
    if (contact && !contact.tags.includes(link.tag)) {
      await prisma.funnelContact.update({
        where: { id: contact.id },
        data: { tags: [...contact.tags, link.tag] },
      });
    }
  } catch (error) {
    console.error("[ATOM funnel] tag on click failed:", error instanceof Error ? error.message : error);
  }
  return NextResponse.redirect(link.url, { status: 302 });
}
