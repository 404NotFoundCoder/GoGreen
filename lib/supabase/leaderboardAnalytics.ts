import { addMonths, endOfMonth, parseISO, startOfMonth } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/client";
import { TIMEZONE } from "@/constants/config";
import {
  fetchGroupMemberIds,
  fetchLeaderboardDailyStatsForPeriod,
  fetchLeaderboardStatsAndUserAggregates,
  type LeaderboardDailyStatRow,
} from "@/lib/supabase/leaderboard";
import type { DailyStatRow } from "@/lib/supabase/stats";
import { fetchUserDailyStatsInRange } from "@/lib/supabase/stats";
import {
  eachDateStringInRange,
  getMonthEndString,
  getYearStartString,
  weekCalendarDayStringsContaining,
} from "@/lib/utils/date";
import { getLeaderboardDateBounds } from "@/lib/utils/leaderboardPeriod";
import {
  computeWeightedRanks,
  rankAllUsers,
  sdgRankSum,
  type LeaderboardPeriod,
} from "@/lib/utils/leaderboard";

/** 分數表折線資料點：`total` 為原始分加總（依圖表範圍：全體、本群或個人） */
export type DailyCompletionPoint = {
  date: string;
  total: number;
  label: string;
};

export type DailyChartMode =
  | "week_daily"
  | "month_four_segments"
  | "all_daily"
  | "all_four_segments"
  | "all_monthly"
  | "all_yearly";

export type GlobalLeaderboardChartsData = {
  totalCompletions: number;
  usersWithFullSdgCoverage: number;
  /** 全體：期間內原始分加總最高者（與「分數」維度榜第 1 名一致）；群組圖表為 null */
  topByScore: { nickname: string; totalRawScore: number } | null;
  /** 全體：期間內 SDG 指標 N+M 最高者（與「SDG 覆蓋」維度榜第 1 名一致）；群組圖表為 null */
  topBySdg: {
    nickname: string;
    sdgMetric: number;
    sdgUnionCount: number;
    maxSdgCoverage: number;
  } | null;
  /** 分數表折線：各點為該日／該段 **原始分加總**（圖表範圍內使用者） */
  dailyCompletions: DailyCompletionPoint[];
  dailyChartMode: DailyChartMode;
  sdgDistribution: { sdgId: number; count: number }[];
  /** 全體統計卡「熱門行動」第 1 名；未載入時 null */
  topHotAction: { label: string; count: number } | null;
};

export function getDailyChartBounds(
  period: LeaderboardPeriod,
  stats: LeaderboardDailyStatRow[],
  defaultStart: string,
  end: string,
): { start: string; end: string } {
  if (period === "all") {
    if (stats.length === 0) return { start: end, end };
    let minD = stats[0]!.date;
    for (const r of stats) {
      if (r.date < minD) minD = r.date;
    }
    return { start: minD, end };
  }
  return { start: defaultStart, end };
}

/** 將日期列均分為四週（每段約 1/4 日數） */
function buildFourSegmentsFromDays(
  days: string[],
  dailyMap: Map<string, number>,
  keyPrefix: string,
): DailyCompletionPoint[] {
  if (days.length === 0) return [];
  const n = days.length;
  const q = Math.ceil(n / 4);
  const labels = ["第1週", "第2週", "第3週", "第4週"];
  const out: DailyCompletionPoint[] = [];
  for (let w = 0; w < 4; w++) {
    const from = w * q;
    const to = w === 3 ? n : Math.min(n, (w + 1) * q);
    let total = 0;
    for (let i = from; i < to; i++) {
      total += dailyMap.get(days[i]!) ?? 0;
    }
    const first = days[from] ?? "";
    out.push({
      date: `${keyPrefix}-seg-${w + 1}-${first}`,
      total,
      label: labels[w]!,
    });
  }
  return out;
}

function buildMonthFourSegments(
  monthStart: string,
  rangeEnd: string,
  dailyMap: Map<string, number>,
): DailyCompletionPoint[] {
  const days = eachDateStringInRange(monthStart, rangeEnd);
  return buildFourSegmentsFromDays(days, dailyMap, "month");
}

/** 至今：依「資料區間長度」自動選粒度（日／四週／月／年） */
function buildCumulativeAdaptive(
  rangeStart: string,
  rangeEnd: string,
  dailyMap: Map<string, number>,
): { points: DailyCompletionPoint[]; mode: DailyChartMode } {
  const days = eachDateStringInRange(rangeStart, rangeEnd);
  const n = days.length;
  if (n === 0) return { points: [], mode: "all_daily" };
  if (n < 7) {
    const weekDays = weekCalendarDayStringsContaining(rangeStart);
    return {
      points: weekDays.map((d) => ({
        date: d,
        total: d >= rangeStart && d <= rangeEnd ? (dailyMap.get(d) ?? 0) : 0,
        label: d.slice(5),
      })),
      mode: "all_daily",
    };
  }
  if (n <= 7) {
    return {
      points: days.map((d) => ({
        date: d,
        total: dailyMap.get(d) ?? 0,
        label: d.slice(5),
      })),
      mode: "all_daily",
    };
  }
  if (n <= 31) {
    return {
      points: buildFourSegmentsFromDays(days, dailyMap, "all"),
      mode: "all_four_segments",
    };
  }
  if (n <= 366) {
    return {
      points: buildMonthlyBuckets(rangeStart, rangeEnd, dailyMap),
      mode: "all_monthly",
    };
  }
  return {
    points: buildYearlyBuckets(rangeStart, rangeEnd, dailyMap),
    mode: "all_yearly",
  };
}

function buildMonthlyBuckets(
  rangeStart: string,
  rangeEnd: string,
  dailyMap: Map<string, number>,
): DailyCompletionPoint[] {
  const out: DailyCompletionPoint[] = [];
  const zStart = toZonedTime(parseISO(`${rangeStart}T12:00:00`), TIMEZONE);
  const zEnd = toZonedTime(parseISO(`${rangeEnd}T12:00:00`), TIMEZONE);
  let cur = startOfMonth(zStart);
  while (cur <= zEnd) {
    const monthStartStr = formatInTimeZone(cur, TIMEZONE, "yyyy-MM-dd");
    const monthEnd = endOfMonth(cur);
    const monthEndStr = formatInTimeZone(monthEnd, TIMEZONE, "yyyy-MM-dd");
    const segStart = monthStartStr < rangeStart ? rangeStart : monthStartStr;
    const segEnd = monthEndStr > rangeEnd ? rangeEnd : monthEndStr;
    if (segStart <= segEnd) {
      let total = 0;
      for (const d of eachDateStringInRange(segStart, segEnd)) {
        total += dailyMap.get(d) ?? 0;
      }
      out.push({
        date: monthStartStr,
        total,
        label: formatInTimeZone(cur, TIMEZONE, "yyyy/MM"),
      });
    }
    cur = addMonths(cur, 1);
  }
  return out;
}

function buildYearlyBuckets(
  rangeStart: string,
  rangeEnd: string,
  dailyMap: Map<string, number>,
): DailyCompletionPoint[] {
  const y0 = parseInt(rangeStart.slice(0, 4), 10);
  const y1 = parseInt(rangeEnd.slice(0, 4), 10);
  const out: DailyCompletionPoint[] = [];
  for (let y = y0; y <= y1; y++) {
    const ys = `${y}-01-01`;
    const ye = `${y}-12-31`;
    const segStart = ys < rangeStart ? rangeStart : ys;
    const segEnd = ye > rangeEnd ? rangeEnd : ye;
    if (segStart > segEnd) continue;
    let total = 0;
    for (const d of eachDateStringInRange(segStart, segEnd)) {
      total += dailyMap.get(d) ?? 0;
    }
    out.push({
      date: `${y}-01-01`,
      total,
      label: `${y} 年`,
    });
  }
  return out;
}

/** 與全體榜「分數表」同構：`total` 為該日／該段之原始分加總（全體／群組彙總或個人單日） */
export function buildCompletionChartSeries(
  period: LeaderboardPeriod,
  dailyMap: Map<string, number>,
  chartStart: string,
  chartEnd: string,
  monthStartForBounds: string,
): {
  points: DailyCompletionPoint[];
  mode: DailyChartMode;
} {
  if (period === "week") {
    const days = eachDateStringInRange(chartStart, chartEnd);
    return {
      points: days.map((d) => ({
        date: d,
        total: dailyMap.get(d) ?? 0,
        label: d.slice(5),
      })),
      mode: "week_daily",
    };
  }
  if (period === "month") {
    const monthEnd = getMonthEndString(
      parseISO(`${monthStartForBounds}T12:00:00`),
    );
    const rangeEnd = chartEnd < monthEnd ? chartEnd : monthEnd;
    return {
      points: buildMonthFourSegments(monthStartForBounds, rangeEnd, dailyMap),
      mode: "month_four_segments",
    };
  }
  return buildCumulativeAdaptive(chartStart, chartEnd, dailyMap);
}

function aggregateFromStats(
  stats: LeaderboardDailyStatRow[],
  opts: {
    period: LeaderboardPeriod;
    defaultStart: string;
    end: string;
    userIds?: Set<string>;
  },
): {
  totalCompletions: number;
  usersWithFullSdgCoverage: number;
  dailyCompletions: DailyCompletionPoint[];
  dailyChartMode: DailyChartMode;
} {
  const userIds = opts.userIds;
  const filtered = userIds
    ? stats.filter((r) => userIds.has(r.user_id))
    : stats;

  const { start, end } = getDailyChartBounds(
    opts.period,
    filtered,
    opts.defaultStart,
    opts.end,
  );

  const dailyMap = new Map<string, number>();
  for (const d of eachDateStringInRange(start, end)) {
    dailyMap.set(d, 0);
  }

  let totalCompletions = 0;
  const userMaxSdg = new Map<string, number>();

  for (const row of filtered) {
    totalCompletions += row.completed_count ?? 0;
    const d = row.date;
    dailyMap.set(
      d,
      (dailyMap.get(d) ?? 0) + Number(row.raw_score ?? 0),
    );
    const uid = row.user_id;
    const cur = userMaxSdg.get(uid) ?? 0;
    userMaxSdg.set(uid, Math.max(cur, row.sdg_coverage ?? 0));
  }

  let usersWithFullSdgCoverage = 0;
  for (const v of userMaxSdg.values()) {
    if (v >= 9) usersWithFullSdgCoverage += 1;
  }

  const { points, mode } = buildCompletionChartSeries(
    opts.period,
    dailyMap,
    start,
    end,
    opts.defaultStart,
  );

  return {
    totalCompletions,
    usersWithFullSdgCoverage,
    dailyCompletions: points,
    dailyChartMode: mode,
  };
}

export async function fetchGlobalLeaderboardCharts(
  period: LeaderboardPeriod,
  options?: { includeWeightedCharts?: boolean },
): Promise<GlobalLeaderboardChartsData> {
  const includeWeighted = options?.includeWeightedCharts !== false;
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();

  if (!includeWeighted) {
    const [{ users }, hotRes] = await Promise.all([
      fetchLeaderboardStatsAndUserAggregates(period),
      supabase.rpc("rpc_global_hot_actions", {
        p_start: start,
        p_end: end,
        p_limit: 1,
      }),
    ]);
    if (hotRes.error) throw hotRes.error;
    const w = computeWeightedRanks(users);
    const byScore = rankAllUsers(users, "score", w);
    const bySdg = rankAllUsers(users, "sdg", w);
    const topScoreRow = byScore[0];
    const topSdgRow = bySdg[0];
    const topByScore = topScoreRow
      ? {
          nickname: topScoreRow.nickname,
          totalRawScore: Math.round(topScoreRow.totalRawScore),
        }
      : null;
    const topBySdg = topSdgRow
      ? {
          nickname: topSdgRow.nickname,
          sdgMetric: sdgRankSum(topSdgRow),
          sdgUnionCount: topSdgRow.sdgUnionCount,
          maxSdgCoverage: topSdgRow.maxSdgCoverage,
        }
      : null;
    const hotRows = hotRes.data as
      | { label: string; action_count: number | string }[]
      | null;
    const first = hotRows?.[0];
    const topHotAction = first
      ? { label: first.label, count: Number(first.action_count) }
      : null;
    return {
      totalCompletions: 0,
      usersWithFullSdgCoverage: 0,
      topByScore,
      topBySdg,
      dailyCompletions: [],
      dailyChartMode: "week_daily",
      sdgDistribution: [],
      topHotAction,
    };
  }

  const [{ stats, users }, sdgRes, hotRes] = await Promise.all([
    fetchLeaderboardStatsAndUserAggregates(period),
    supabase.rpc("rpc_global_sdg_distribution", {
      p_start: start,
      p_end: end,
    }),
    supabase.rpc("rpc_global_hot_actions", {
      p_start: start,
      p_end: end,
      p_limit: 1,
    }),
  ]);

  if (sdgRes.error) throw sdgRes.error;
  if (hotRes.error) throw hotRes.error;

  const base = aggregateFromStats(stats, { period, defaultStart: start, end });

  const w = computeWeightedRanks(users);
  const byScore = rankAllUsers(users, "score", w);
  const bySdg = rankAllUsers(users, "sdg", w);
  const topScoreRow = byScore[0];
  const topSdgRow = bySdg[0];
  const topByScore = topScoreRow
    ? {
        nickname: topScoreRow.nickname,
        totalRawScore: Math.round(topScoreRow.totalRawScore),
      }
    : null;
  const topBySdg = topSdgRow
    ? {
        nickname: topSdgRow.nickname,
        sdgMetric: sdgRankSum(topSdgRow),
        sdgUnionCount: topSdgRow.sdgUnionCount,
        maxSdgCoverage: topSdgRow.maxSdgCoverage,
      }
    : null;

  const sdgRows = sdgRes.data as
    | { sdg_id: number; action_count: number | string }[]
    | null;
  const sdgDistribution = (sdgRows ?? []).map((r) => ({
    sdgId: r.sdg_id,
    count: Number(r.action_count),
  }));

  const hotRows = hotRes.data as
    | { label: string; action_count: number | string }[]
    | null;
  const firstHot = hotRows?.[0];
  const topHotAction = firstHot
    ? { label: firstHot.label, count: Number(firstHot.action_count) }
    : null;

  return {
    ...base,
    topByScore,
    topBySdg,
    sdgDistribution,
    topHotAction,
  };
}

export async function fetchGroupLeaderboardCharts(
  groupId: string,
  period: LeaderboardPeriod,
  options?: { includeWeightedCharts?: boolean },
): Promise<GlobalLeaderboardChartsData> {
  const includeWeighted = options?.includeWeightedCharts !== false;
  const { start, end } = getLeaderboardDateBounds(period);
  const memberIds = await fetchGroupMemberIds(groupId);
  const idSet = new Set(memberIds);

  const { users } = await fetchLeaderboardStatsAndUserAggregates(period);
  const groupUsers = users.filter((u) => idSet.has(u.userId));
  const w = computeWeightedRanks(groupUsers);
  const byScore = rankAllUsers(groupUsers, "score", w);
  const bySdg = rankAllUsers(groupUsers, "sdg", w);
  const topScoreRow = byScore[0];
  const topSdgRow = bySdg[0];
  const topByScore = topScoreRow
    ? {
        nickname: topScoreRow.nickname,
        totalRawScore: Math.round(topScoreRow.totalRawScore),
      }
    : null;
  const topBySdg = topSdgRow
    ? {
        nickname: topSdgRow.nickname,
        sdgMetric: sdgRankSum(topSdgRow),
        sdgUnionCount: topSdgRow.sdgUnionCount,
        maxSdgCoverage: topSdgRow.maxSdgCoverage,
      }
    : null;

  const supabase = createClient();
  const hotRes = await supabase.rpc("rpc_group_hot_actions", {
    p_group_id: groupId,
    p_start: start,
    p_end: end,
    p_limit: 1,
  });
  if (hotRes.error) throw hotRes.error;
  const hotRows = hotRes.data as
    | { label: string; action_count: number | string }[]
    | null;
  const firstHot = hotRows?.[0];
  const topHotAction = firstHot
    ? { label: firstHot.label, count: Number(firstHot.action_count) }
    : null;

  if (!includeWeighted) {
    return {
      totalCompletions: 0,
      usersWithFullSdgCoverage: 0,
      topByScore,
      topBySdg,
      dailyCompletions: [],
      dailyChartMode: "week_daily",
      sdgDistribution: [],
      topHotAction,
    };
  }

  const stats = await fetchLeaderboardDailyStatsForPeriod(period);
  const base = aggregateFromStats(stats, {
    period,
    defaultStart: start,
    end,
    userIds: idSet,
  });

  const sdgRes = await supabase.rpc("rpc_group_sdg_distribution", {
    p_group_id: groupId,
    p_start: start,
    p_end: end,
  });

  if (sdgRes.error) throw sdgRes.error;

  const sdgRows = sdgRes.data as
    | { sdg_id: number; action_count: number | string }[]
    | null;
  const sdgDistribution = (sdgRows ?? []).map((r) => ({
    sdgId: r.sdg_id,
    count: Number(r.action_count),
  }));

  return {
    ...base,
    topByScore,
    topBySdg,
    sdgDistribution,
    topHotAction,
  };
}

export type MySdgDistributionRow = { sdgId: number; count: number };

export async function fetchMySdgDistribution(
  start: string,
  end: string,
): Promise<MySdgDistributionRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_my_sdg_distribution", {
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  const rows = data as
    | { sdg_id: number; action_count: number | string }[]
    | null;
  return (rows ?? []).map((r) => ({
    sdgId: r.sdg_id,
    count: Number(r.action_count),
  }));
}

/** 個人資料圖：分數表折線（`dailyScores`）、完成筆數系列（`dailyCompletions`）、SDG 分布；期間與所選「本週／本月／至今」一致。「至今」為 **今年 1/1～今日**（與打卡密度 GitHub 圖一致）。 */
export async function fetchUserProfileCharts(
  period: LeaderboardPeriod,
  userId: string,
): Promise<{
  dailyCompletions: DailyCompletionPoint[];
  dailyScores: DailyCompletionPoint[];
  dailyChartMode: DailyChartMode;
  sdgDistribution: MySdgDistributionRow[];
  chartStart: string;
  chartEnd: string;
  heatmapRows: DailyStatRow[];
}> {
  const { start: defaultStart, end } = getLeaderboardDateBounds(period);
  const fetchStart = period === "all" ? getYearStartString() : defaultStart;
  const rows = (await fetchUserDailyStatsInRange(
    userId,
    fetchStart,
    end,
  )) as DailyStatRow[];

  const fakeStats: LeaderboardDailyStatRow[] = rows.map((r) => ({
    user_id: userId,
    date: r.date,
    normalized_score: r.normalized_score,
    completed_count: r.completed_count,
    sdg_coverage: r.sdg_coverage,
    raw_score: r.raw_score,
    streak: r.streak,
  }));

  const bounds = getDailyChartBounds(period, fakeStats, defaultStart, end);
  const chartStart = period === "all" ? getYearStartString() : bounds.start;
  const chartEnd = period === "all" ? end : bounds.end;

  const completionMap = new Map<string, number>();
  const rawMap = new Map<string, number>();
  for (const d of eachDateStringInRange(chartStart, chartEnd)) {
    completionMap.set(d, 0);
    rawMap.set(d, 0);
  }
  for (const r of rows) {
    if (r.date < chartStart || r.date > chartEnd) continue;
    completionMap.set(
      r.date,
      (completionMap.get(r.date) ?? 0) + r.completed_count,
    );
    rawMap.set(r.date, (rawMap.get(r.date) ?? 0) + r.raw_score);
  }

  const { points: dailyCompletions, mode: dailyChartMode } =
    buildCompletionChartSeries(
      period,
      completionMap,
      chartStart,
      chartEnd,
      defaultStart,
    );
  const { points: dailyScores } = buildCompletionChartSeries(
    period,
    rawMap,
    chartStart,
    chartEnd,
    defaultStart,
  );

  const sdgDistribution = await fetchMySdgDistribution(chartStart, chartEnd);

  return {
    dailyCompletions,
    dailyScores,
    dailyChartMode,
    sdgDistribution,
    chartStart,
    chartEnd,
    /** 供熱力圖：期間內有打卡之日的原始列 */
    heatmapRows: rows.filter((r) => r.date >= chartStart && r.date <= chartEnd),
  };
}
