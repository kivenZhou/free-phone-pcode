import { NextRequest, NextResponse } from "next/server";
import {
  isRefreshRunning,
  refreshProviders,
  startRefreshInBackground,
} from "@/lib/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requiredToken = process.env.REFRESH_TOKEN?.trim();
  if (requiredToken) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== requiredToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let provider: string | undefined;
  let cont = false;
  try {
    const body = (await req.json()) as { provider?: string; continue?: boolean };
    provider = body.provider;
    cont = Boolean(body.continue);
  } catch {
    // empty body is fine
  }

  // Cloudflare / serverless: return immediately; sync continues via waitUntil + batch chain.
  if (process.env.DISABLE_BACKGROUND_REFRESH === "1") {
    const status = await startRefreshInBackground(provider, { continue: cont });
    return NextResponse.json(status);
  }

  if (!cont && (await isRefreshRunning())) {
    return NextResponse.json({ started: false, syncing: true, alreadyRunning: true });
  }

  const result = await refreshProviders(provider, { continue: cont });
  return NextResponse.json({ started: true, syncing: !result.done, ...result });
}
