import { createClient } from "@/lib/supabase/client";

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
