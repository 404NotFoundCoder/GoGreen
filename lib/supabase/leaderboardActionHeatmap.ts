import { createClient } from "@/lib/supabase/client";
import { getLeaderboardDateBounds } from "@/lib/utils/leaderboardPeriod";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";

export type TemplateItemStatRow = {
  itemId: string;
  title: string;
  sortOrder: number;
  periodDays: number;
  activeUsers: number;
  checkinCount: number;
  achieverCount: number;
};

export type CustomTitleStatRow = {
  title: string;
  /**
   * 新 RPC：列入今日清單人日數（`user_daily_custom_items`，依標題彙總）。
   * 舊 RPC 未套用時：改以 period_days×active_users 填入供分母用，並標 `legacyListDenominator`。
   */
  onListDays: number;
  checkinCount: number;
  achieverCount: number;
  /** 後端仍回傳舊欄位時為 true；畫面應提示套用 `20260322141000_custom_title_stats_list_days.sql` */
  legacyListDenominator?: boolean;
};

function templateRatePct(row: TemplateItemStatRow): number {
  const denom = row.periodDays * Math.max(row.activeUsers, 1);
  if (denom <= 0) return 0;
  return Math.min(100, Math.round((1000 * row.checkinCount) / denom) / 10);
}

function customRatePct(row: CustomTitleStatRow): number {
  const list = safeNonNeg(row.onListDays);
  const chk = safeNonNeg(row.checkinCount);
  const denom = Math.max(list, chk, 1);
  return Math.min(100, Math.round((1000 * chk) / denom) / 10);
}

function safeNonNeg(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export async function fetchDefaultTemplateItemStats(
  period: LeaderboardPeriod,
): Promise<TemplateItemStatRow[]> {
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_default_template_item_stats",
    { p_start: start, p_end: end },
  );
  if (error) throw error;
  const rows = data as
    | {
        item_id: string;
        title: string;
        sort_order: number;
        period_days: number;
        active_users: number | string;
        checkin_count: number | string;
        achiever_count: number | string;
      }[]
    | null;
  return (rows ?? []).map((r) => ({
    itemId: r.item_id,
    title: r.title,
    sortOrder: r.sort_order,
    periodDays: r.period_days,
    activeUsers: Number(r.active_users),
    checkinCount: Number(r.checkin_count),
    achieverCount: Number(r.achiever_count),
  }));
}

export async function fetchCustomTitleStats(
  period: LeaderboardPeriod,
  limit = 30,
): Promise<CustomTitleStatRow[]> {
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_custom_title_stats",
    { p_start: start, p_end: end, p_limit: limit },
  );
  if (error) throw error;
  const rows = data as Record<string, unknown>[] | null;
  return (rows ?? []).map(mapCustomTitleStatRow);
}

function mapCustomTitleStatRow(r: Record<string, unknown>): CustomTitleStatRow {
  const title = typeof r.title === "string" ? r.title : String(r.title ?? "");
  const checkinCount = safeNonNeg(r.checkin_count);
  const achieverCount = safeNonNeg(r.achiever_count);

  const rawList = r.on_list_days;
  const hasNew =
    rawList !== undefined &&
    rawList !== null &&
    !(typeof rawList === "string" && rawList === "");

  if (hasNew) {
    return {
      title,
      onListDays: safeNonNeg(rawList),
      checkinCount,
      achieverCount,
    };
  }

  const pd = safeNonNeg(r.period_days);
  const au = safeNonNeg(r.active_users);
  const legacyDenom = pd * Math.max(au, 1);
  return {
    title,
    onListDays: Number.isFinite(legacyDenom) ? legacyDenom : 0,
    checkinCount,
    achieverCount,
    legacyListDenominator: true,
  };
}

export async function fetchTemplateItemDayDensityMap(
  period: LeaderboardPeriod,
  itemId: string,
): Promise<Map<string, number>> {
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_template_item_day_density",
    { p_start: start, p_end: end, p_item_id: itemId },
  );
  if (error) throw error;
  const rows = data as { d: string; participant_count: number | string }[] | null;
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    const k = typeof r.d === "string" ? r.d : String(r.d).slice(0, 10);
    m.set(k, Number(r.participant_count));
  }
  return m;
}

export async function fetchCustomTitleDayDensityMap(
  period: LeaderboardPeriod,
  title: string,
): Promise<Map<string, number>> {
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_custom_title_day_density",
    { p_start: start, p_end: end, p_title: title },
  );
  if (error) throw error;
  const rows = data as { d: string; checkin_count: number | string }[] | null;
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    const k = typeof r.d === "string" ? r.d : String(r.d).slice(0, 10);
    m.set(k, Number(r.checkin_count));
  }
  return m;
}

export type CellParticipant = {
  userId: string;
  nickname: string;
  photoUrl: string | null;
};

export async function fetchTemplateItemCellParticipants(
  date: string,
  itemId: string,
): Promise<CellParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_template_item_cell_participants",
    { p_date: date, p_item_id: itemId },
  );
  if (error) throw error;
  const rows = data as
    | { user_id: string; nickname: string; photo_url: string | null }[]
    | null;
  return (rows ?? []).map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    photoUrl: r.photo_url,
  }));
}

export async function fetchCustomTitleCellParticipants(
  date: string,
  title: string,
): Promise<CellParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_custom_title_cell_participants",
    { p_date: date, p_title: title },
  );
  if (error) throw error;
  const rows = data as
    | { user_id: string; nickname: string; photo_url: string | null }[]
    | null;
  return (rows ?? []).map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    photoUrl: r.photo_url,
  }));
}

export { templateRatePct, customRatePct };
