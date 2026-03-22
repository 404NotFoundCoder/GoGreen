import { getMonthStartString, getTodayString, getWeekStartString } from "@/lib/utils/date";
import type { ActionCompletionPeriod, LeaderboardPeriod } from "@/lib/utils/leaderboard";

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

/** 「各項完成率」卡片：今日＝當日；本週／本月與榜單語意一致（至今日止） */
export function getActionCompletionDateBounds(
  period: ActionCompletionPeriod,
): { start: string; end: string } {
  const end = getTodayString();
  if (period === "today") {
    return { start: end, end };
  }
  if (period === "week") {
    return { start: getWeekStartString(), end };
  }
  return { start: getMonthStartString(), end };
}

export function actionCompletionScopeLabel(
  period: ActionCompletionPeriod,
): string {
  if (period === "today") return "今日";
  if (period === "week") return "本週";
  return "本月";
}
