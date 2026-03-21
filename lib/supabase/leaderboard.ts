import { createClient } from "@/lib/supabase/client";
import {
  getMonthStartString,
  getTodayString,
  getWeekStartString,
} from "@/lib/utils/date";
import {
  computeWeightedRanks,
  type LeaderboardDimension,
  type LeaderboardPeriod,
  sortByDimension,
  type RankedRow,
  type UserPeriodAgg,
} from "@/lib/utils/leaderboard";

export type GlobalLeaderboardResult = {
  rows: RankedRow[];
  /** 該期間內曾出現在 user_daily_stats 的不重複使用者數（榜單僅顯示前 LEADERBOARD_LIMIT 名） */
  totalParticipants: number;
};

export async function fetchGlobalLeaderboard(
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
): Promise<GlobalLeaderboardResult> {
  const supabase = createClient();
  const today = getTodayString();

  let q = supabase
    .from("user_daily_stats")
    .select(
      "user_id, date, normalized_score, completed_count, sdg_coverage, raw_score",
    )
    .lte("date", today);

  if (period === "week") {
    q = q.gte("date", getWeekStartString());
  } else if (period === "month") {
    q = q.gte("date", getMonthStartString());
  }

  const { data: stats, error } = await q;
  if (error) throw error;

  const { data: users, error: uerr } = await supabase
    .from("users")
    .select("id, nickname");
  if (uerr) throw uerr;

  const nick = new Map((users ?? []).map((u) => [u.id, u.nickname]));

  const agg = new Map<
    string,
    { sumNorm: number; days: number; totalComp: number; maxSdg: number }
  >();

  for (const row of stats ?? []) {
    const uid = row.user_id as string;
    const cur = agg.get(uid) ?? {
      sumNorm: 0,
      days: 0,
      totalComp: 0,
      maxSdg: 0,
    };
    cur.sumNorm += Number(row.normalized_score);
    cur.days += 1;
    cur.totalComp += row.completed_count as number;
    cur.maxSdg = Math.max(cur.maxSdg, row.sdg_coverage as number);
    agg.set(uid, cur);
  }

  const list: UserPeriodAgg[] = [];
  for (const [userId, v] of agg) {
    list.push({
      userId,
      nickname: nick.get(userId) ?? "—",
      avgNormalized: v.days ? v.sumNorm / v.days : 0,
      totalCompleted: v.totalComp,
      maxSdgCoverage: v.maxSdg,
    });
  }

  const weighted = computeWeightedRanks(list);
  const totalParticipants = list.length;
  const rows = sortByDimension(list, dimension, weighted);
  return { rows, totalParticipants };
}
