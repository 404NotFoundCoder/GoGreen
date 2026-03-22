"use client";

import { TIMEZONE } from "@/constants/config";
import { periodScopeLabel } from "@/components/leaderboard/LeaderboardPeriodBar";
import {
  GlobalDailyCompletionBars,
  SdgDistributionBars,
} from "@/components/leaderboard/LeaderboardViz";
import { useAuthContext } from "@/context/AuthContext";
import {
  fetchUserProfileCharts,
  type DailyChartMode,
} from "@/lib/supabase/leaderboardAnalytics";
import type { DailyStatRow } from "@/lib/supabase/stats";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  eachDateStringInRange,
  getMonthStartString,
  getTodayString,
  getWeekStartString,
  getYearEndString,
  getYearStartString,
  weekCalendarDayStringsContaining,
} from "@/lib/utils/date";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  getISODay,
  parseISO,
  startOfMonth,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * 五階（依使用者當日清單個人化）：無／少／一半／多／全完成。
 * 有 `total_items` 時以完成比例為主；無則以完成項數備援。
 */
function heatLevel(r: DailyStatRow): number {
  if (r.completed_count <= 0) return 0;
  if (r.total_items > 0) {
    if (r.completed_count >= r.total_items) return 4;
    const ratio = r.completed_count / r.total_items;
    if (ratio >= 0.5) return 2;
    if (r.completed_count <= 3) return 1;
    return 3;
  }
  if (r.completed_count <= 3) return 1;
  return 3;
}

const HEAT_BG = [
  "bg-[var(--color-muted)]/25",
  "bg-[var(--color-primary-strong)]/22",
  "bg-[var(--color-primary-strong)]/40",
  "bg-[var(--color-primary-strong)]/58",
  "bg-[var(--color-primary-strong)]",
] as const;

const HEAT_LEGEND: { label: string; swatch: string }[] = [
  { label: "無", swatch: HEAT_BG[0]! },
  { label: "少", swatch: HEAT_BG[1]! },
  { label: "一半", swatch: HEAT_BG[2]! },
  { label: "多", swatch: HEAT_BG[3]! },
  { label: "全完成", swatch: HEAT_BG[4]! },
];

/** 週視圖大卡片：底色＋邊框（與色階一致） */
const HEAT_CARD_SURFACE = [
  "border-[var(--color-muted)]/50 bg-[var(--color-muted)]/15",
  "border-[var(--color-primary-strong)]/35 bg-[var(--color-primary-strong)]/20",
  "border-[var(--color-primary-strong)]/42 bg-[var(--color-primary-strong)]/34",
  "border-[var(--color-primary-strong)]/50 bg-[var(--color-primary-strong)]/48",
  "border-[var(--color-primary-strong)] bg-[var(--color-primary-strong)]/85 text-[var(--color-white)]",
];

const WEEKDAY_ZH = ["一", "二", "三", "四", "五", "六", "日"] as const;

/** 圖二：M/d · N 項完成 · 分（hover／title） */
function heatTooltip(
  dateStr: string,
  row: DailyStatRow | null,
  todayStr: string,
): string {
  const md = formatInTimeZone(
    parseISO(`${dateStr}T12:00:00`),
    TIMEZONE,
    "M/d",
  );
  if (dateStr > todayStr) {
    return `${md} · 尚未到達`;
  }
  if (!row || row.completed_count <= 0) {
    return `${md} · 0 項完成 · 0 分`;
  }
  return `${md} · ${row.completed_count} 項完成 · ${row.raw_score} 分`;
}

function longestActiveStreak(rows: DailyStatRow[]): number {
  const active = rows
    .filter((r) => r.completed_count > 0)
    .map((r) => r.date)
    .sort();
  if (active.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < active.length; i++) {
    const a = parseISO(`${active[i - 1]}T12:00:00`);
    const b = parseISO(`${active[i]}T12:00:00`);
    if (differenceInCalendarDays(b, a) === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

function computeHeatmapSummaryStats(
  rows: DailyStatRow[],
  chartStart: string,
  chartEnd: string,
): {
  totalScore: number;
  checkInDays: number;
  longestStreak: number;
} {
  const inRange = rows.filter(
    (r) => r.date >= chartStart && r.date <= chartEnd,
  );
  const totalScore = inRange.reduce((s, r) => s + r.raw_score, 0);
  const checkInDays = inRange.filter((r) => r.completed_count > 0).length;
  const longestStreak = longestActiveStreak(inRange);
  return { totalScore, checkInDays, longestStreak };
}

function columnMondayString(col: (string | null)[]): string | null {
  const first = col.find((d) => d != null);
  if (!first) return null;
  return getWeekStartString(parseISO(`${first}T12:00:00`));
}

function columnSundayString(col: (string | null)[]): string | null {
  const mon = columnMondayString(col);
  if (!mon) return null;
  return formatInTimeZone(
    addDays(parseISO(`${mon}T12:00:00`), 6),
    TIMEZONE,
    "yyyy-MM-dd",
  );
}

/** 至今視圖：每欄頂部對應「含該月 1 日」之週欄，標示 `M月` */
function buildGithubMonthLabels(
  weekCols: (string | null)[][],
  chartStart: string,
  chartEnd: string,
): (string | null)[] {
  const labels: (string | null)[] = weekCols.map(() => null);
  let cur = startOfMonth(parseISO(`${chartStart}T12:00:00`));
  const endD = parseISO(`${chartEnd}T12:00:00`);
  while (cur <= endD) {
    const ms = formatInTimeZone(cur, TIMEZONE, "yyyy-MM-dd");
    for (let wi = 0; wi < weekCols.length; wi++) {
      const mon = columnMondayString(weekCols[wi]!);
      const sun = columnSundayString(weekCols[wi]!);
      if (!mon || !sun) continue;
      if (ms >= mon && ms <= sun) {
        labels[wi] = formatInTimeZone(cur, TIMEZONE, "M月");
        break;
      }
    }
    cur = addMonths(cur, 1);
  }
  return labels;
}

/** GitHub 風：欄＝週（週一～週日七格一欄），列由上到下為週一至週日 */
function buildGithubWeekColumns(
  chartStart: string,
  chartEnd: string,
): (string | null)[][] {
  const cols: (string | null)[][] = [];
  let monday = getWeekStartString(parseISO(`${chartStart}T12:00:00`));
  const end = chartEnd;
  while (monday <= end) {
    const col: (string | null)[] = [];
    const base = parseISO(`${monday}T12:00:00`);
    for (let d = 0; d < 7; d++) {
      const dateStr = formatInTimeZone(
        addDays(base, d),
        TIMEZONE,
        "yyyy-MM-dd",
      );
      if (dateStr < chartStart || dateStr > chartEnd) {
        col.push(null);
      } else {
        col.push(dateStr);
      }
    }
    cols.push(col);
    const nextMonday = addDays(base, 7);
    const nextStr = formatInTimeZone(nextMonday, TIMEZONE, "yyyy-MM-dd");
    if (nextStr > end) break;
    monday = nextStr;
  }
  return cols;
}

/** 月曆：7 欄（週一～週日），補齊前後空白 */
function buildMonthCalendarCells(
  monthStart: string,
  monthEnd: string,
): (string | null)[] {
  const days = eachDateStringInRange(monthStart, monthEnd);
  if (days.length === 0) return [];
  const first = days[0]!;
  const firstOff = getISODay(parseISO(`${first}T12:00:00`)) - 1;
  const cells: (string | null)[] = [
    ...Array(Math.max(0, firstOff)).fill(null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function HeatCell({
  date,
  row,
  todayStr,
  fluid = false,
}: {
  date: string | null;
  row: DailyStatRow | null;
  todayStr: string;
  /** 至今視圖：格與週欄填滿容器寬（與上方摘要卡同寬） */
  fluid?: boolean;
}) {
  const cellBase = fluid
    ? "aspect-square w-full min-h-0 rounded-[2px]"
    : "h-[10px] w-[10px] shrink-0 rounded-[2px]";
  if (!date) {
    return (
      <div className={`${cellBase} bg-transparent`} aria-hidden />
    );
  }
  const effectiveRow =
    date > todayStr ? null : row;
  const lv = effectiveRow ? heatLevel(effectiveRow) : 0;
  const bg = HEAT_BG[lv] ?? HEAT_BG[0];
  return (
    <div
      title={heatTooltip(date, effectiveRow, todayStr)}
      className={[
        cellBase,
        "border border-[var(--color-muted)]/20",
        bg,
      ].join(" ")}
    />
  );
}

function MonthHeatCell({
  date,
  row,
  todayStr,
}: {
  date: string | null;
  row: DailyStatRow | null;
  todayStr: string;
}) {
  if (!date) {
    return (
      <div
        className="aspect-square w-full min-w-0 rounded-[4px] bg-transparent"
        aria-hidden
      />
    );
  }
  const effectiveRow = date > todayStr ? null : row;
  const lv = effectiveRow ? heatLevel(effectiveRow) : 0;
  const count = effectiveRow?.completed_count ?? 0;
  const bg = HEAT_BG[lv] ?? HEAT_BG[0];
  return (
    <div
      title={heatTooltip(date, effectiveRow, todayStr)}
      className={[
        "flex aspect-square w-full min-w-0 flex-col items-center justify-center rounded-[4px] border border-[var(--color-muted)]/25 p-0.5 text-center",
        bg,
      ].join(" ")}
    >
      <span
        className={[
          "max-w-full truncate px-0.5 text-[9px] font-semibold leading-tight tabular-nums sm:text-[10px]",
          lv === 4 ? "text-[var(--color-white)]" : "text-[var(--color-ink)]",
        ].join(" ")}
      >
        {count > 0 ? `${count}項` : "\u00a0"}
      </span>
    </div>
  );
}

/** 至今 GitHub 式熱力：單一 grid 對齊月份列與週欄，避免兩列 flex 各自 flex-1 造成偏移 */
function GithubYearHeatmap({
  weekCols,
  monthLabels,
  byDate,
  todayStr,
}: {
  weekCols: (string | null)[][];
  monthLabels: (string | null)[];
  byDate: Map<string, DailyStatRow>;
  todayStr: string;
}) {
  const n = weekCols.length;
  const weekdayRows = ["一", "", "三", "", "五", "", "日"] as const;
  const templateCols =
    n === 0 ? "1.25rem" : (`1.25rem repeat(${n}, minmax(0.75rem, 1fr))` as const);

  const bodyCells = Array.from({ length: 7 }, (_, dayIdx) => {
    const left = (
      <div
        key={`w-${dayIdx}`}
        className="flex min-h-0 items-center justify-end tabular-nums py-0.5 pr-1 text-[9px] text-[var(--color-subtle)]"
        style={{ gridColumn: 1, gridRow: dayIdx + 2 }}
      >
        {weekdayRows[dayIdx]}
      </div>
    );
    const cells = weekCols.map((col, wi) => {
      const date = col[dayIdx] ?? null;
      return (
        <div
          key={`c-${wi}-${dayIdx}`}
          className="min-w-0 self-stretch"
          style={{ gridColumn: wi + 2, gridRow: dayIdx + 2 }}
        >
          <HeatCell
            date={date}
            row={date ? (byDate.get(date) ?? null) : null}
            todayStr={todayStr}
            fluid
          />
        </div>
      );
    });
    return [left, ...cells];
  }).flat();

  return (
    <div className="mt-3 w-full min-w-0 px-0.5">
      <div className="w-full overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch] overscroll-x-contain pb-0.5 md:overflow-x-visible">
        <div
          className="grid w-full min-w-0 gap-px pb-1"
          style={{
            gridTemplateColumns: templateCols,
            gridTemplateRows: "auto repeat(7, auto)",
          }}
        >
          <div style={{ gridColumn: 1, gridRow: 1 }} aria-hidden />
          {monthLabels.map((lab, wi) => (
            <div
              key={`m-${wi}`}
              className="relative min-h-[18px] min-w-0"
              style={{ gridColumn: wi + 2, gridRow: 1 }}
            >
              {lab ? (
                <span className="absolute bottom-0 left-0 z-10 whitespace-nowrap text-[8px] leading-none text-[var(--color-subtle)]">
                  {lab}
                </span>
              ) : null}
            </div>
          ))}
          {bodyCells}
        </div>
      </div>
    </div>
  );
}

function WeekDayCard({
  date,
  row,
  todayStr,
}: {
  date: string;
  row: DailyStatRow | null;
  todayStr: string;
}) {
  const isFuture = date > todayStr;
  const isToday = date === todayStr;
  const dayIdx = getISODay(parseISO(`${date}T12:00:00`)) - 1;
  const label = WEEKDAY_ZH[dayIdx] ?? "—";

  if (isFuture) {
    return (
      <div
        title={heatTooltip(date, null, todayStr)}
        className="flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--color-muted)]/50 bg-[var(--color-white)] px-1 py-3 text-[var(--color-subtle)]"
        aria-label={`${date} 尚未到達`}
      >
        <span className="text-xs font-medium text-[var(--color-ink-secondary)]">
          {label}
        </span>
        <span className="text-lg leading-none">·</span>
      </div>
    );
  }

  const lv = row ? heatLevel(row) : 0;
  const surface = HEAT_CARD_SURFACE[lv] ?? HEAT_CARD_SURFACE[0];
  const count = row?.completed_count ?? 0;

  return (
    <div
      title={heatTooltip(date, row, todayStr)}
      className={[
        "flex min-w-[4.5rem] flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-3",
        surface,
        isToday ? "ring-2 ring-inset ring-[var(--color-primary-strong)]" : "",
      ].join(" ")}
    >
      <span
        className={[
          "text-xs font-medium",
          lv === 4
            ? "text-[var(--color-white)]/95"
            : "text-[var(--color-ink-secondary)]",
        ].join(" ")}
      >
        {label}
      </span>
      <span
        className={[
          "text-xs font-semibold tabular-nums sm:text-sm",
          lv === 4 ? "text-[var(--color-white)]" : "text-[var(--color-ink)]",
        ].join(" ")}
      >
        {count}項
      </span>
    </div>
  );
}

function profileCompletionTitle(
  mode: DailyChartMode | undefined,
  pl: string,
): string {
  if (mode === "week_daily") return `完成項次（個人·${pl}·每日）`;
  if (mode === "month_four_segments")
    return `完成項次（個人·${pl}·四週）`;
  if (mode === "all_daily") return `完成項次（個人·至今·每日）`;
  if (mode === "all_four_segments")
    return `完成項次（個人·至今·四週）`;
  if (mode === "all_monthly") return `完成項次（個人·至今·按月）`;
  if (mode === "all_yearly") return `完成項次（個人·至今·按年）`;
  return `完成項次（個人·${pl}）`;
}

function profileCompletionSubtitle(mode: DailyChartMode | undefined): string {
  if (mode === "week_daily")
    return "本週一至今日每日加總；無完成為 0。與全體榜「完成項次」粒度一致。";
  if (mode === "month_four_segments")
    return "將本月 1 日至今日均分為四週，加總各週完成數（非自然週）。";
  if (mode === "all_daily")
    return "至今未滿一週：補齊該曆週 7 日逐日顯示；滿一週至 7 日內亦逐日。";
  if (mode === "all_four_segments")
    return "至今區間 8～31 天：依日數均分四週加總。";
  if (mode === "all_monthly")
    return "至今區間 32 天～一年：依曆月加總。";
  if (mode === "all_yearly") return "至今超過一年：依曆年加總。";
  return "";
}

function profileHeatmapTitle(period: LeaderboardPeriod, pl: string): string {
  if (period === "week") return `本週打卡密度（${pl}）`;
  if (period === "month") return `本月打卡密度（${pl}）`;
  return `今年打卡密度（${pl}）`;
}

export function ProfileChartsSection({
  period,
}: {
  period: LeaderboardPeriod;
}) {
  const { user, loading: authLoading } = useAuthContext();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchUserProfileCharts>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pl = periodScopeLabel(period);

  const load = useCallback(async () => {
    if (!user?.id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchUserProfileCharts(period, user.id);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user?.id, period]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const byDate = useMemo(() => {
    if (!data) return new Map<string, DailyStatRow>();
    return new Map(data.heatmapRows.map((r) => [r.date, r]));
  }, [data]);

  const heatmapLayout = useMemo(() => {
    if (!data) return null;
    const { chartStart, chartEnd } = data;

    if (period === "week") {
      const days = weekCalendarDayStringsContaining(chartEnd);
      return { kind: "week_cards" as const, days };
    }

    if (period === "month") {
      const ms = getMonthStartString(
        parseISO(`${data.chartEnd}T12:00:00`),
      );
      const cells = buildMonthCalendarCells(ms, data.chartEnd);
      return { kind: "month" as const, cells };
    }

    const hs = getYearStartString();
    const he = getYearEndString();
    const weekCols = buildGithubWeekColumns(hs, he);
    const monthLabels = buildGithubMonthLabels(weekCols, hs, he);
    return { kind: "github" as const, weekCols, monthLabels };
  }, [data, period]);

  const summaryStats = useMemo(() => {
    if (!data) return null;
    return computeHeatmapSummaryStats(
      data.heatmapRows,
      data.chartStart,
      data.chartEnd,
    );
  }, [data]);

  const todayStr = getTodayString();

  if (!authLoading && !user) {
    return null;
  }

  const showHeatmap =
    Boolean(data && heatmapLayout) && !error;
  const sdgSubtitle = data
    ? `公版與自訂行動打卡次數（${pl}，${data.chartStart}～${data.chartEnd}）`
    : "";

  const showChartsBusy = loading || authLoading;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          {profileHeatmapTitle(period, pl)}
        </h2>
        <p className="mt-1 text-xs text-[var(--color-ink-secondary)]">
          {period === "week"
            ? "本週一至今日：每日一卡，僅顯示完成項數；未來日期顯示「·」。"
            : period === "month"
              ? "本月：月曆格對齊週一至週日；格內顯示完成項數（0 項留白）。"
              : "選「至今」時：GitHub 式小格涵蓋今年 1～12 月完整曆週（未來日為空白）；頂列標月份；格內不顯示項數。手機版可橫向滑動檢視。hover 顯示日期、項數、得分。"}
        </p>

        {error ? (
          <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
            圖表載入失敗：{error}
            <span className="mt-1 block text-xs text-[var(--color-subtle)]">
              若為 SDG 分布，請確認已套用 migration
              `20260321220000_leaderboard_analytics_rpc.sql`。
            </span>
          </p>
        ) : null}

        {summaryStats && showHeatmap ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                累計得分
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summaryStats.totalScore.toLocaleString("zh-Hant-TW")}
              </p>
            </div>
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                打卡天數
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summaryStats.checkInDays.toLocaleString("zh-Hant-TW")}
              </p>
            </div>
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                最長 streak
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summaryStats.longestStreak > 0
                  ? `${summaryStats.longestStreak} 天`
                  : "—"}
              </p>
            </div>
          </div>
        ) : showChartsBusy && !error ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : null}

        {showHeatmap && heatmapLayout ? (
          heatmapLayout.kind === "week_cards" ? (
          <div className="mt-3 flex gap-2 overflow-x-auto px-0.5 py-0.5 pb-1">
            {heatmapLayout.days.map((date) => (
              <WeekDayCard
                key={date}
                date={date}
                row={byDate.get(date) ?? null}
                todayStr={todayStr}
              />
            ))}
          </div>
        ) : heatmapLayout.kind === "github" ? (
          <GithubYearHeatmap
            weekCols={heatmapLayout.weekCols}
            monthLabels={heatmapLayout.monthLabels}
            byDate={byDate}
            todayStr={todayStr}
          />
        ) : (
          <div className="mt-3 w-full min-w-0">
            <div className="mb-1 grid w-full min-w-0 grid-cols-7 gap-px text-center text-[9px] text-[var(--color-subtle)]">
              {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                <span key={d} className="min-w-0 truncate">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid w-full min-w-0 grid-cols-7 gap-px [grid-template-columns:repeat(7,minmax(0,1fr))]">
              {heatmapLayout.cells.map((date, i) => (
                <MonthHeatCell
                  key={date ?? `pad-${i}`}
                  date={date}
                  row={date ? (byDate.get(date) ?? null) : null}
                  todayStr={todayStr}
                />
              ))}
            </div>
          </div>
        )
        ) : showChartsBusy && !error ? (
          <Skeleton className="mt-3 h-44 w-full rounded-xl" />
        ) : null}

        {showHeatmap && heatmapLayout ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px] text-[var(--color-subtle)] md:gap-x-3">
          <span className="font-medium text-[var(--color-ink-secondary)]">
            圖例
          </span>
          <span className="max-w-full text-[9px] leading-snug text-[var(--color-subtle)] md:text-[10px]">
            （依當日完成比例；無清單則以項數）
          </span>
          {HEAT_LEGEND.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span
                className={[
                  "h-2.5 w-2.5 shrink-0 rounded-[2px]",
                  item.swatch,
                ].join(" ")}
              />
              {item.label}
            </span>
          ))}
        </div>
        ) : null}
      </section>

      <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          {data
            ? profileCompletionTitle(data.dailyChartMode, pl)
            : `完成項次（個人·${pl}）`}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
          {data
            ? profileCompletionSubtitle(data.dailyChartMode)
            : "與全體榜「完成項次」粒度一致；載入中…"}
        </p>
        <div className="mt-6 flex min-h-[200px] flex-col justify-end overflow-x-auto overflow-y-visible pb-2 pt-2">
          {data ? (
            <GlobalDailyCompletionBars points={data.dailyCompletions} />
          ) : (
            <Skeleton className="h-52 w-full rounded-xl" />
          )}
        </div>
      </section>

      <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          個人 SDG 行動分布
        </h2>
        <p className="mt-1 text-xs text-[var(--color-ink-secondary)]">
          {data ? sdgSubtitle : `公版與自訂行動打卡次數（${pl}，載入中…）`}
        </p>
        <div className="mt-4 max-h-64 overflow-y-auto pr-1">
          {data ? (
            <SdgDistributionBars rows={data.sdgDistribution} />
          ) : (
            <Skeleton className="h-48 w-full rounded-xl" />
          )}
        </div>
      </section>
    </div>
  );
}
