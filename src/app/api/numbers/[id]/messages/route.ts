import { NextRequest, NextResponse } from "next/server";
import {
  getCachedMessages,
  getNumberById,
  setCachedMessages,
} from "@/lib/db";
import { getProvider } from "@/lib/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 8_000;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const force = req.nextUrl.searchParams.get("force") === "1";
  const number = getNumberById(id);

  if (!number) {
    return NextResponse.json({ error: "Number not found" }, { status: 404 });
  }

  if (!force) {
    const cached = getCachedMessages(id, CACHE_MS);
    if (cached) {
      return NextResponse.json({
        number,
        messages: cached.messages,
        fetchedAt: cached.fetchedAt,
        cached: true,
      });
    }
  }

  const provider = getProvider(number.providerId);
  if (!provider) {
    return NextResponse.json({ error: "Provider unavailable" }, { status: 503 });
  }

  try {
    const messages = await provider.listMessages(number.e164, number.meta);
    setCachedMessages(id, messages);
    return NextResponse.json({
      number,
      messages,
      fetchedAt: Date.now(),
      cached: false,
    });
  } catch (err) {
    const cached = getCachedMessages(id, 30 * 60_000);
    if (cached) {
      return NextResponse.json({
        number,
        messages: cached.messages,
        fetchedAt: cached.fetchedAt,
        cached: true,
        warning: err instanceof Error ? err.message : String(err),
      });
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        number,
        messages: [],
      },
      { status: 502 },
    );
  }
}
