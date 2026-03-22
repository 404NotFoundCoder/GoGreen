"use client";

import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";

export const LEADERBOARD_PERIODS: {
  id: LeaderboardPeriod;
  label: string;
}[] = [
  { id: "week", label: "本週" },
  { id: "month", label: "本月" },
  { id: "all", label: "至今" },
];

export function periodScopeLabel(period: LeaderboardPeriod): string {
  if (period === "week") return "本週";
  if (period === "month") return "本月";
  return "至今";
}

export function LeaderboardPeriodBar({
  period,
  onChange,
}: {
  period: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
}) {
  return (
    <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto overflow-y-visible px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LEADERBOARD_PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={[
            "relative isolate shrink-0 min-h-[40px] rounded-full border border-transparent px-4 py-2 text-sm font-medium transition",
            period === p.id
              ? "border-[var(--color-primary-strong)]/25 bg-[var(--color-primary-light)] text-[var(--color-ink)] shadow-sm"
              : "border-[var(--color-muted)]/80 bg-[var(--color-surface)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-white)]/80",
          ].join(" ")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
