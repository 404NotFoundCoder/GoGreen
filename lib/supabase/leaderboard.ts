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
  type UserPeriodAgg,
} from "@/lib/utils/leaderboard";

export async function fetchGlobalLeaderboard(
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
) {
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
  return sortByDimension(list, dimension, weighted);
}
