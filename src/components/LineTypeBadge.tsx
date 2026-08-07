"use client";

import type { LineType } from "@/lib/phone";
import { lineTypeLabel } from "@/lib/phone";

export function LineTypeBadge({ type }: { type: LineType }) {
  const label = lineTypeLabel(type);
  const styles =
    type === "physical"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : type === "virtual"
        ? "bg-sky-100 text-sky-800 border-sky-200"
        : "bg-stone-100 text-stone-600 border-stone-200";

  const icon = type === "physical" ? "📶" : type === "virtual" ? "☁️" : "❔";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${styles}`}
      title={
        type === "physical"
          ? "实体 SIM / 实卡线路（共享公开收件箱）"
          : type === "virtual"
            ? "虚拟号 / VoIP / 云线路（多数免费公开接码）"
            : "未能可靠判断号码类型"
      }
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
