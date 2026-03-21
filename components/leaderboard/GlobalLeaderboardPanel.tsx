"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useGlobalLeaderboard } from "@/hooks/useGlobalLeaderboard";
import type { LeaderboardDimension, LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { useState } from "react";

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "week", label: "本週" },
  { id: "month", label: "本月" },
  { id: "all", label: "累計" },
];

const DIMS: { id: LeaderboardDimension; label: string }[] = [
  { id: "weighted", label: "總加權" },
  { id: "score", label: "分數" },
  { id: "count", label: "完成數" },
  { id: "sdg", label: "SDG 覆蓋" },
];

function formatMetric(
  d: LeaderboardDimension,
  row: {
    avgNormalized: number;
    totalCompleted: number;
    maxSdgCoverage: number;
    weightedPoints?: number;
  },
) {
  if (d === "weighted") return `${row.weightedPoints ?? 0} 分`;
  if (d === "score") return row.avgNormalized.toFixed(1);
  if (d === "count") return `${row.totalCompleted} 項`;
  return `${row.maxSdgCoverage} 個目標`;
}

export function GlobalLeaderboardPanel() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [dimension, setDimension] = useState<LeaderboardDimension>("weighted");
  const { data, loading, error } = useGlobalLeaderboard(period, dimension);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={[
              "min-h-[44px] rounded-full px-4 py-2 text-sm font-medium",
              period === p.id
                ? "bg-[var(--color-primary-strong)] text-[var(--color-white)]"
                : "border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-ink)]",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="排行榜維度"
      >
        {DIMS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={dimension === d.id}
            onClick={() => setDimension(d.id)}
            className={[
              "min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap",
              dimension === d.id
                ? "bg-[var(--color-primary-pale)] text-[var(--color-primary-dark)] ring-2 ring-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-[var(--color-ink-secondary)]",
            ].join(" ")}
          >
            {d.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      {error ? (
        <p className="text-[var(--color-ink)]">{error.message}</p>
      ) : null}

      {!loading && !error && (!data || data.length === 0) ? (
        <p className="rounded-2xl border-[0.5px] border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] p-6 text-center leading-relaxed text-[var(--color-ink-secondary)]">
          還沒有人上榜，成為第一個完成行動的人吧！
        </p>
      ) : null}

      {!loading && data && data.length > 0 ? (
        <ol className="space-y-2">
          {data.map((row) => (
            <li
              key={row.userId}
              className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-8 shrink-0 text-center font-semibold text-[var(--color-primary-dark)]">
                  {row.rank}
                </span>
                <span className="truncate font-medium text-[var(--color-ink)]">
                  {row.nickname}
                </span>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-[var(--color-ink-secondary)]">
                {formatMetric(dimension, row)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
