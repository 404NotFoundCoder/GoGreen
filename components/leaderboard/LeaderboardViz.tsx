"use client";

import { RankMark } from "@/components/leaderboard/RankMark";
import { SDG_COLORS } from "@/constants/sdg";
import type { DailyCompletionPoint } from "@/lib/supabase/leaderboardAnalytics";
import type { RankedRow } from "@/lib/utils/leaderboard";

const CHART_INNER_PX = 112;

export function GlobalDailyCompletionBars({
  points,
  valueSuffix = "次完成",
}: {
  points: DailyCompletionPoint[];
  /** 例如「次完成」「分」 */
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.total));
  if (points.length === 0) {
    return (
      <p className="text-sm text-[var(--color-subtle)]">此期間尚無完成資料。</p>
    );
  }
  return (
    <div
      className="flex w-full items-end gap-px sm:gap-1"
      style={{ height: CHART_INNER_PX }}
    >
      {points.map((p) => {
        const isZero = p.total <= 0;
        const hPx = isZero
          ? 3
          : Math.max(
              6,
              Math.round((p.total / max) * (CHART_INNER_PX - 4)),
            );
        return (
          <div
            key={p.date}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <div
              className={
                isZero
                  ? "w-full max-w-[28px] rounded-t-md bg-[var(--color-muted)]/40"
                  : "w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-[var(--color-primary-dark)] to-[var(--color-primary-strong)] shadow-md shadow-[var(--color-primary-dark)]/25"
              }
              style={{ height: hPx }}
              title={`${p.date}：${p.total} ${valueSuffix}`}
            />
            <span className="w-full truncate text-center text-[10px] leading-tight text-[var(--color-subtle)] sm:text-[10px]">
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SdgDistributionBars({
  rows,
}: {
  rows: { sdgId: number; count: number }[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-subtle)]">尚無 SDG 打卡次數。</p>
    );
  }
  const total = rows.reduce((s, r) => s + r.count, 0);
  const denom = Math.max(1, total);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const meta = SDG_COLORS[r.sdgId];
        const label = meta?.label ?? `SDG ${r.sdgId}`;
        const pct = Math.round((r.count / denom) * 1000) / 10;
        const barPct = Math.min(100, (r.count / denom) * 100);
        const accent = meta?.text ?? "var(--color-primary-dark)";
        return (
          <li key={r.sdgId}>
            <div className="mb-0.5 flex justify-between gap-2 text-xs">
              <span
                className="inline-flex max-w-[70%] truncate rounded-full px-2 py-0.5 font-medium"
                style={{
                  background: meta?.bg ?? "var(--color-primary-pale)",
                  color: accent,
                }}
              >
                {label}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-[var(--color-ink)]">
                {pct}%
                <span className="ml-1 font-normal text-[var(--color-ink-secondary)]">
                  （{r.count} 次）
                </span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--color-white)] shadow-inner shadow-black/5">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${barPct}%`,
                  background: `linear-gradient(90deg, ${accent}cc 0%, ${accent} 55%, ${accent}f2 100%)`,
                  boxShadow: `2px 0 8px -1px ${accent}99`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function HotActionsList({
  items,
}: {
  items: { label: string; count: number }[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--color-subtle)]">尚無熱門行動資料。</p>
    );
  }
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li
          key={`${it.label}-${i}`}
          className="flex items-center justify-between gap-2 rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-white)]/70 px-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate font-medium text-[var(--color-ink)]">
            {i + 1}. {it.label}
          </span>
          <span className="shrink-0 tabular-nums text-[var(--color-ink-secondary)]">
            {it.count} 次
          </span>
        </li>
      ))}
    </ol>
  );
}

export function GroupMemberCountBars({ rows }: { rows: RankedRow[] }) {
  const list = rows.slice(0, 12);
  const max = Math.max(1, ...list.map((r) => r.totalCompleted));
  if (list.length === 0) return null;
  return (
    <div className="space-y-2">
      {list.map((r) => (
        <div key={r.userId} className="flex items-center gap-2 text-sm">
          <div className="flex w-7 shrink-0 items-center justify-center">
            <RankMark rank={r.rank} size="sm" />
          </div>
          <span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">
            {r.nickname}
          </span>
          <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-[var(--color-white)] sm:block">
            <div
              className="h-full rounded-full bg-[var(--color-primary-pale)]"
              style={{ width: `${(r.totalCompleted / max) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right tabular-nums text-[var(--color-ink-secondary)]">
            {r.totalCompleted} 項
          </span>
        </div>
      ))}
    </div>
  );
}
