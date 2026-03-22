import { getMonthStartString, getTodayString, getWeekStartString } from "@/lib/utils/date";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";

/** RPC 與打卡分析用：與 `fetchLeaderboardDailyStatsForPeriod` 期間一致 */
export function getLeaderboardDateBounds(period: LeaderboardPeriod): {
  start: string;
  end: string;
} {
  const end = getTodayString();
  if (period === "week") {
    return { start: getWeekStartString(), end };
  }
  if (period === "month") {
    return { start: getMonthStartString(), end };
  }
  return { start: "2000-01-01", end };
}
