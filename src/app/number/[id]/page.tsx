import { Suspense } from "react";
import { NumberDetailClient } from "@/components/NumberDetailClient";

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
