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
  sdgIds: number[];
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
  sdgIds: number[];
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

function parseSdgIds(raw: unknown): number[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const x of raw) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= 1 && n <= 17) out.push(n);
  }
  return out;
}

export async function fetchDefaultTemplateItemStatsForRange(
  start: string,
  end: string,
): Promise<TemplateItemStatRow[]> {
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
        sdg_ids?: unknown;
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
    sdgIds: parseSdgIds(r.sdg_ids),
  }));
}

export async function fetchDefaultTemplateItemStats(
  period: LeaderboardPeriod,
): Promise<TemplateItemStatRow[]> {
  const { start, end } = getLeaderboardDateBounds(period);
  return fetchDefaultTemplateItemStatsForRange(start, end);
}

export async function fetchCustomTitleStatsForRange(
  start: string,
  end: string,
  limit = 30,
): Promise<CustomTitleStatRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_custom_title_stats",
    { p_start: start, p_end: end, p_limit: limit },
  );
  if (error) throw error;
  const rows = data as Record<string, unknown>[] | null;
  return (rows ?? []).map(mapCustomTitleStatRow);
}

export async function fetchCustomTitleStats(
  period: LeaderboardPeriod,
  limit = 30,
): Promise<CustomTitleStatRow[]> {
  const { start, end } = getLeaderboardDateBounds(period);
  return fetchCustomTitleStatsForRange(start, end, limit);
}

export function mapCustomTitleStatRow(r: Record<string, unknown>): CustomTitleStatRow {
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
      sdgIds: parseSdgIds(r.sdg_ids),
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
    sdgIds: parseSdgIds(r.sdg_ids),
  };
}

export async function fetchTemplateItemDayDensityMapForRange(
  start: string,
  end: string,
  itemId: string,
): Promise<Map<string, number>> {
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

export async function fetchTemplateItemDayDensityMap(
  period: LeaderboardPeriod,
  itemId: string,
): Promise<Map<string, number>> {
  const { start, end } = getLeaderboardDateBounds(period);
  return fetchTemplateItemDayDensityMapForRange(start, end, itemId);
}

export async function fetchCustomTitleDayDensityMapForRange(
  start: string,
  end: string,
  title: string,
): Promise<Map<string, number>> {
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

function photoDatesRowsToSet(
  rows: { d: string }[] | null | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const r of rows ?? []) {
    const k = typeof r.d === "string" ? r.d : String(r.d).slice(0, 10);
    out.add(k);
  }
  return out;
}

/** 公版項目：該日至少一筆打卡含佐證（全體榜密度圖角標） */
export async function fetchTemplateItemPhotoDatesSetForRange(
  start: string,
  end: string,
  itemId: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_template_item_day_photo_dates",
    { p_start: start, p_end: end, p_item_id: itemId },
  );
  if (error) throw error;
  return photoDatesRowsToSet(data as { d: string }[] | null);
}

/** 自訂標題：該日至少一筆打卡含 `photo_url`（密度圖角標）；RPC 未套用時請 catch 後用空 Set */
export async function fetchCustomTitlePhotoDatesSetForRange(
  start: string,
  end: string,
  title: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_custom_title_day_photo_dates",
    { p_start: start, p_end: end, p_title: title },
  );
  if (error) throw error;
  return photoDatesRowsToSet(data as { d: string }[] | null);
}

/** 個人頁：公版項目含佐證之日期 */
export async function fetchProfileTemplateItemPhotoDatesSetForRange(
  start: string,
  end: string,
  itemId: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_profile_template_item_day_photo_dates",
    { p_start: start, p_end: end, p_item_id: itemId },
  );
  if (error) throw error;
  return photoDatesRowsToSet(data as { d: string }[] | null);
}

/** 個人頁：自訂標題含佐證之日期（僅本人，勿用全體榜 RPC） */
export async function fetchProfileCustomTitlePhotoDatesSetForRange(
  start: string,
  end: string,
  title: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_profile_custom_title_day_photo_dates",
    { p_start: start, p_end: end, p_title: title },
  );
  if (error) throw error;
  return photoDatesRowsToSet(data as { d: string }[] | null);
}

export async function fetchCustomTitleDayDensityMap(
  period: LeaderboardPeriod,
  title: string,
): Promise<Map<string, number>> {
  const { start, end } = getLeaderboardDateBounds(period);
  return fetchCustomTitleDayDensityMapForRange(start, end, title);
}

export type CellParticipant = {
  userId: string;
  nickname: string;
  /** 該日打卡上傳之佐證 */
  photoUrl: string | null;
  /** 個人頭像（users.photo_url，OAuth 同步） */
  avatarUrl: string | null;
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
    | {
        user_id: string;
        nickname: string;
        photo_url: string | null;
        avatar_url?: string | null;
      }[]
    | null;
  return (rows ?? []).map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    photoUrl: r.photo_url,
    avatarUrl:
      typeof r.avatar_url === "string" && r.avatar_url.length > 0
        ? r.avatar_url
        : null,
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
    | {
        user_id: string;
        nickname: string;
        photo_url: string | null;
        avatar_url?: string | null;
      }[]
    | null;
  return (rows ?? []).map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    photoUrl: r.photo_url,
    avatarUrl:
      typeof r.avatar_url === "string" && r.avatar_url.length > 0
        ? r.avatar_url
        : null,
  }));
}

export async function fetchProfileTemplateItemStatsForRange(
  start: string,
  end: string,
): Promise<TemplateItemStatRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_profile_template_item_stats", {
    p_start: start,
    p_end: end,
  });
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
        sdg_ids?: unknown;
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
    sdgIds: parseSdgIds(r.sdg_ids),
  }));
}

export async function fetchProfileCustomTitleStatsForRange(
  start: string,
  end: string,
  limit = 40,
): Promise<CustomTitleStatRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_profile_custom_title_stats", {
    p_start: start,
    p_end: end,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = data as Record<string, unknown>[] | null;
  return (rows ?? []).map(mapCustomTitleStatRow);
}

export async function fetchProfileTemplateItemDayDensityMapForRange(
  start: string,
  end: string,
  itemId: string,
): Promise<Map<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_profile_template_item_day_density",
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

export async function fetchProfileCustomTitleDayDensityMapForRange(
  start: string,
  end: string,
  title: string,
): Promise<Map<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_profile_custom_title_day_density",
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

export { templateRatePct, customRatePct };
