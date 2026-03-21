import { createClient } from "@/lib/supabase/client";
import { getTodayString } from "@/lib/utils/date";
import { subDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/constants/config";

export type DailyStatRow = {
  date: string;
  completed_count: number;
  total_items: number;
  raw_score: number;
  normalized_score: number;
  streak: number;
  sdg_coverage: number;
};

export async function fetchUserDailyStatsForDate(userId: string, date: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_daily_stats")
    .select(
      "completed_count, total_items, raw_score, normalized_score, streak, sdg_coverage",
    )
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** 最近 N 天有資料的每日統計（含今日），新到舊 */
export async function fetchUserDailyStatsRecent(
  userId: string,
  days: number,
): Promise<DailyStatRow[]> {
  const supabase = createClient();
  const today = getTodayString();
  const z = toZonedTime(new Date(), TIMEZONE);
  const from = subDays(z, days - 1);
  const fromStr = formatInTimeZone(from, TIMEZONE, "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("user_daily_stats")
    .select(
      "date, completed_count, total_items, raw_score, normalized_score, streak, sdg_coverage",
    )
    .eq("user_id", userId)
    .gte("date", fromStr)
    .lte("date", today)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DailyStatRow[];
}
