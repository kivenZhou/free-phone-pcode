import { Suspense } from "react";
import fs from "fs";
import path from "path";
import { NumberDetailClient } from "@/components/NumberDetailClient";


export async function generateStaticParams() {
  if (process.env.GITHUB_PAGES !== "true") return [];

  const storePath = path.join(process.cwd(), "public/static-data/store.json");
  if (!fs.existsSync(storePath)) return [];

  const store = JSON.parse(fs.readFileSync(storePath, "utf8")) as {
    numbers?: Array<{ id: string }>;
  };

  return (store.numbers ?? []).map((n) => ({ id: n.id }));
}

export default async function NumberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="page-shell py-20 text-center text-[var(--muted)]">加载中…</div>
      }
    >
      <NumberDetailClient id={id} />
    </Suspense>
  );
}
