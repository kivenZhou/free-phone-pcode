"use client";

import { isStaticExport, LIVE_SITE_URL, REPO_URL } from "@/lib/site";

export function StaticDemoBanner({ builtAt }: { builtAt?: number }) {
  if (!isStaticExport()) return null;

  const builtLabel = builtAt
    ? new Date(builtAt).toLocaleString("zh-CN")
    : "最近一次构建";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
      <strong>GitHub Pages 静态演示</strong>
      ：数据来自 CI 构建快照（{builtLabel}），无法实时同步或拉取新短信。
      完整实时站见{" "}
      <a
        href={LIVE_SITE_URL}
        className="font-semibold underline underline-offset-2"
        target="_blank"
        rel="noopener noreferrer"
      >
        phone.fastx.ink
      </a>
      ，或查看{" "}
      <a
        href={`${REPO_URL}#生产部署`}
        className="font-semibold underline underline-offset-2"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub 部署说明
      </a>
      。
    </div>
  );
}
