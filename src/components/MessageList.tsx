"use client";

import { CopyButton } from "./CopyButton";
import { MessageTime } from "./MessageTime";

export interface MessageItem {
  from: string;
  text: string;
  receivedAt: number;
  otp?: string;
}

function highlightOtp(text: string, otp?: string) {
  if (!otp) return text;
  const idx = text.indexOf(otp);
  if (idx < 0) {
    const spaced = otp.replace(/(\d{3})(\d{3})/, "$1 $2");
    const i2 = text.indexOf(spaced);
    if (i2 >= 0) {
      return (
        <>
          {text.slice(0, i2)}
          <mark className="rounded bg-[var(--accent)]/20 px-1 font-semibold text-[var(--accent-2)]">
            {spaced}
          </mark>
          {text.slice(i2 + spaced.length)}
        </>
      );
    }
    return text;
  }
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[var(--accent)]/20 px-1 font-semibold text-[var(--accent-2)]">
        {otp}
      </mark>
      {text.slice(idx + otp.length)}
    </>
  );
}

export function MessageList({ messages }: { messages: MessageItem[] }) {
  if (!messages.length) {
    return (
      <div className="glass-panel rounded-2xl px-6 py-16 text-center text-lg text-[var(--muted)]">
        暂无短信。可刷新，或换一个更活跃的号码。
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {messages.map((m, i) => (
        <li key={`${m.receivedAt}-${i}`} className="glass-panel rounded-2xl px-6 py-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-base font-semibold text-[var(--ink)]">
              {m.from || "未知发件人"}
            </span>
            <MessageTime at={m.receivedAt} />
          </div>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--ink)]/90">
            {highlightOtp(m.text, m.otp)}
          </p>
          {m.otp ? (
            <div className="mt-4 flex items-center gap-3">
              <span className="font-display text-3xl font-bold tracking-[0.12em] text-[var(--accent-2)]">
                {m.otp}
              </span>
              <CopyButton value={m.otp} label="复制验证码" />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
