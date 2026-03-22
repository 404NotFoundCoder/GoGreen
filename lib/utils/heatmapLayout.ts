import { TIMEZONE } from "@/constants/config";
import {
  eachDateStringInRange,
  getMonthStartString,
  getWeekStartString,
  weekCalendarDayStringsContaining,
} from "@/lib/utils/date";
import type { ActionCompletionPeriod, LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { addDays, addMonths, getISODay, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

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

/** GitHub 風：欄＝週（週一～週日七格一欄），列由上到下為週一至週日 */
export function buildGithubWeekColumns(
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

export function buildGithubMonthLabels(
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

/** 月曆：7 欄（週一～週日），補齊前後空白（與個人頁熱力一致） */
export function buildMonthCalendarCells(
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

export type HeatmapLayout =
  | { kind: "week_cards"; days: string[] }
  | { kind: "month"; cells: (string | null)[] }
  | {
      kind: "github";
      weekCols: (string | null)[][];
      monthLabels: (string | null)[];
    };

export function resolveHeatmapLayoutForPeriod(
  period: LeaderboardPeriod,
  chartStart: string,
  chartEnd: string,
): HeatmapLayout {
  if (period === "week") {
    return {
      kind: "week_cards",
      days: weekCalendarDayStringsContaining(chartEnd),
    };
  }
  if (period === "month") {
    const ms = getMonthStartString(parseISO(`${chartEnd}T12:00:00`));
    return {
      kind: "month",
      cells: buildMonthCalendarCells(ms, chartEnd),
    };
  }
  const weekCols = buildGithubWeekColumns(chartStart, chartEnd);
  const monthLabels = buildGithubMonthLabels(weekCols, chartStart, chartEnd);
  return { kind: "github", weekCols, monthLabels };
}

/** 各項完成率密度圖：今日＝單日格；本週＝週曆卡；本月＝月曆格（與頁面頂部期間分離） */
export function resolveHeatmapLayoutForActionCompletion(
  period: ActionCompletionPeriod,
  chartEnd: string,
): HeatmapLayout {
  if (period === "today") {
    return { kind: "week_cards", days: [chartEnd] };
  }
  if (period === "week") {
    return {
      kind: "week_cards",
      days: weekCalendarDayStringsContaining(chartEnd),
    };
  }
  const ms = getMonthStartString(parseISO(`${chartEnd}T12:00:00`));
  return {
    kind: "month",
    cells: buildMonthCalendarCells(ms, chartEnd),
  };
}

/** 自訂起訖日：≤14 日用橫向日卡；更長用 GitHub 週欄（可橫向捲動） */
export function resolveHeatmapLayoutForDateRange(
  start: string,
  end: string,
): HeatmapLayout {
  if (start === end) {
    return { kind: "week_cards", days: [end] };
  }
  const days = eachDateStringInRange(start, end);
  if (days.length > 0 && days.length <= 14) {
    return { kind: "week_cards", days };
  }
  const weekCols = buildGithubWeekColumns(start, end);
  const monthLabels = buildGithubMonthLabels(weekCols, start, end);
  return { kind: "github", weekCols, monthLabels };
}
