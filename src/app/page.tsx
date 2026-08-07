import { Suspense } from "react";
import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell py-20 text-center text-[var(--muted)]">加载中…</div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
