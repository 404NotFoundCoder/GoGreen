"use client";

import { RankMark } from "@/components/leaderboard/RankMark";
import { SDG_COLORS } from "@/constants/sdg";
import type { DailyCompletionPoint } from "@/lib/supabase/leaderboardAnalytics";
import type { RankedRow } from "@/lib/utils/leaderboard";

const CHART_INNER_PX = 112;
/** 每欄最小寬度：避免窄螢幕 flex 擠成單一可見色塊，並在點位多時改以橫向捲動閱讀 */
const BAR_COL_MIN_PX = 24;

function MemberBarAvatar({
  nickname,
  photoUrl,
}: {
  nickname: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[var(--color-primary-pale)]"
        referrerPolicy="no-referrer"
      />
    );
  }
  const t = nickname.trim();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-xs font-semibold text-[var(--color-primary-dark)]">
      {t ? t.slice(0, 1) : "?"}
    </div>
  );
}

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
  const minChartWidth = `max(100%, ${points.length * BAR_COL_MIN_PX}px)`;
  return (
    <div
      className="flex w-full min-w-0 items-end justify-start gap-px sm:gap-1"
      style={{ height: CHART_INNER_PX, minWidth: minChartWidth }}
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
            className="flex min-w-[20px] flex-1 shrink-0 flex-col items-center justify-end gap-1"
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
        const goalLabel = meta?.label ?? "—";
        const pct = Math.round((r.count / denom) * 1000) / 10;
        const barPct = Math.min(100, (r.count / denom) * 100);
        const accent = meta?.text ?? "var(--color-primary-dark)";
        return (
          <li key={r.sdgId}>
            <div className="mb-0.5 flex justify-between gap-2 text-xs">
              <span
                className="inline-flex max-w-[78%] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: meta?.bg ?? "var(--color-primary-pale)",
                  color: accent,
                }}
                title={`SDG ${r.sdgId} ${goalLabel}`}
              >
                <span className="shrink-0 tabular-nums">SDG {r.sdgId}</span>
                <span className="min-w-0 truncate font-medium opacity-95">
                  {goalLabel}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-[var(--color-ink)]">
                {pct}%
                <span className="ml-1 font-normal text-[var(--color-ink-secondary)]">
                  （{r.count} 次）
                </span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--color-surface)] shadow-inner shadow-black/5">
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

export function GroupMemberCountBars({ rows }: { rows: RankedRow[] }) {
  const list = rows.slice(0, 12);
  const max = Math.max(1, ...list.map((r) => r.totalCompleted));
  if (list.length === 0) return null;
  return (
    <div className="space-y-2">
      {list.map((r) => (
        <div
          key={r.userId}
          className="flex items-center justify-between gap-2 text-sm sm:gap-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex w-7 shrink-0 items-center justify-center">
              <RankMark rank={r.rank} size="sm" />
            </div>
            <MemberBarAvatar nickname={r.nickname} photoUrl={r.photoUrl} />
            <span className="min-w-0 truncate text-[var(--color-ink)]">
              {r.nickname}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-[var(--color-white)] sm:block">
              <div
                className="h-full rounded-full bg-[var(--color-primary-pale)]"
                style={{ width: `${(r.totalCompleted / max) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right tabular-nums text-[var(--color-ink-secondary)]">
              {r.totalCompleted} 項
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
