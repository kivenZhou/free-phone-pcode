export function Disclaimer() {
  return (
    <div className="glass-panel rounded-2xl px-6 py-4 text-base text-[var(--ink)]">
      <p className="font-semibold text-[var(--accent-2)]">公开共享号码提示</p>
      <p className="mt-2 leading-relaxed text-[var(--muted)]">
        号码与短信来自第三方网站<strong>公开展示</strong>的共享收件箱，人人可见。请勿用于银行、支付、隐私账号或任何敏感验证。本站不拥有这些号码，与各接码平台无官方关系，也不保证送达率。部署公开实例前请阅读仓库中的{" "}
        <code className="rounded bg-black/5 px-1.5 py-0.5 text-sm">DISCLAIMER.md</code>
        。
      </p>
    </div>
  );
}
