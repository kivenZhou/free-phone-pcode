"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label = "复制",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex cursor-pointer items-center rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3 py-1.5 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/15 ${className}`}
    >
      {copied ? "已复制" : label}
    </button>
  );
}
