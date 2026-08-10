import { NextRequest, NextResponse } from "next/server";
import {
  isRefreshRunning,
  refreshProviders,
  startRefreshInBackground,
} from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cloudflare Cron 定时同步入口 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Cron on Workers: kick off and return quickly so the trigger isn't cancelled.
  if (process.env.DISABLE_BACKGROUND_REFRESH === "1") {
    const status = await startRefreshInBackground();
    return NextResponse.json({ triggered: true, ...status });
  }

  if (await isRefreshRunning()) {
    return NextResponse.json({ triggered: false, syncing: true, alreadyRunning: true });
  }

  const result = await refreshProviders();
  return NextResponse.json({ triggered: true, ...result });
}
