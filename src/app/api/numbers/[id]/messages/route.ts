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
/** force=1 最短重新抓取间隔，防止高频轮询打穿上游 */
const FORCE_COOLDOWN_MS = 10_000;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const forceParam = req.nextUrl.searchParams.get("force") === "1";
  const number = await getNumberById(id);

  if (!number) {
    return NextResponse.json({ error: "Number not found" }, { status: 404 });
  }

  // 即使客户端传 force=1，若缓存仍在冷却窗口内也直接返回缓存，
  // 避免高频自动刷新每次都打到上游导致 502。
  const cached = await getCachedMessages(id, forceParam ? FORCE_COOLDOWN_MS : CACHE_MS);
  if (cached) {
    return NextResponse.json({
      number,
      messages: cached.messages,
      fetchedAt: cached.fetchedAt,
      cached: true,
    });
  }

  const provider = await getProvider(number.providerId);
  if (!provider) {
    return NextResponse.json({ error: "Provider unavailable" }, { status: 503 });
  }

  if (provider.supportsMessages === false) {
    return NextResponse.json({
      number,
      messages: [],
      fetchedAt: Date.now(),
      cached: false,
      warning: `${provider.name} 来源受反爬保护，暂不支持实时拉取短信。`,
    });
  }

  try {
    const messages = await provider.listMessages(number.e164, number.meta);
    await setCachedMessages(id, messages);
    return NextResponse.json({
      number,
      messages,
      fetchedAt: Date.now(),
      cached: false,
    });
  } catch (err) {
    const cached = await getCachedMessages(id, 30 * 60_000);
    if (cached) {
      return NextResponse.json({
        number,
        messages: cached.messages,
        fetchedAt: cached.fetchedAt,
        cached: true,
        warning: `上游暂时异常，显示缓存短信：${err instanceof Error ? err.message : String(err)}`,
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
