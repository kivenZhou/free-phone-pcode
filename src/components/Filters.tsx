"use client";

export interface FiltersProps {
  providers: Array<{ id: string; name: string; enabled: boolean }>;
  provider: string;
  lineType: string;
  q: string;
  onProviderChange: (v: string) => void;
  onLineTypeChange: (v: string) => void;
  onQueryChange: (v: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  showRefresh?: boolean;
}

export function Filters({
  providers,
  provider,
  lineType,
  q,
  onProviderChange,
  onLineTypeChange,
  onQueryChange,
  onRefresh,
  refreshing,
  showRefresh = true,
}: FiltersProps) {
  return (
    <div className="glass-panel relative z-50 overflow-visible rounded-2xl p-5 lg:p-6">
      <div className="relative z-50 flex flex-col gap-4 overflow-visible lg:flex-row lg:items-end lg:gap-5">
        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium text-[var(--muted)]">
          来源平台
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="field-input cursor-pointer"
          >
            <option value="">全部来源</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {!p.enabled ? "（已禁用）" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium text-[var(--muted)]">
          号码类型
          <select
            value={lineType}
            onChange={(e) => onLineTypeChange(e.target.value)}
            className="field-input cursor-pointer"
          >
            <option value="">全部类型</option>
            <option value="virtual">☁️ 虚拟号 / VoIP</option>
            <option value="physical">📶 实体卡</option>
            <option value="unknown">❔ 类型未知</option>
          </select>
        </label>

        <label className="flex min-w-0 flex-[1.4] flex-col gap-2 text-sm font-medium text-[var(--muted)]">
          搜索号码
          <input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="区号或号码，如 86、1202"
            className="field-input"
          />
        </label>

        {showRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-primary shrink-0 lg:min-w-[10rem]"
          >
            {refreshing ? "同步中…" : "同步全部来源"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
