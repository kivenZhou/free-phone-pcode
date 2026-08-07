"use client";

import { isStaticExport } from "@/lib/site";

export function StaticDemoBanner({ builtAt }: { builtAt?: number }) {
  if (!isStaticExport()) return null;

  const builtLabel = builtAt
    ? new Date(builtAt).toLocaleString("zh-CN")
    : "最近一次构建";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
      <strong>GitHub Pages 静态演示</strong>
      ：数据来自 CI 构建快照（{builtLabel}），无法实时同步或拉取新短信。
      如需完整功能，请 clone 仓库后在 Node 环境运行，或查看{" "}
      <a
        href="https://github.com/kivenZhou/free-phone-pcode#生产部署"
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
