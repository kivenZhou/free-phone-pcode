import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Free PCode · 免费接码聚合",
  description: "汇总多家公开免费临时号码与验证码短信",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col font-sans">
        <main className="relative z-10 flex-1">{children}</main>
        <footer className="relative z-10 border-t border-[var(--line)] px-[var(--page-pad)] py-8 text-center text-sm text-[var(--muted)]">
          Free PCode · 聚合公开免费接码站数据（参考{" "}
          <a
            className="underline decoration-[var(--accent)]/40 underline-offset-2 hover:text-[var(--accent)]"
            href="https://www.w3h5.dev/post/619.html?lang=ch"
            target="_blank"
            rel="noreferrer"
          >
            w3h5 接码汇总
          </a>
          ）· 非本站自有号码 · 仅供测试
        </footer>
      </body>
    </html>
  );
}
