import { createClient } from "@/lib/supabase/client";
import {
  normalizeCheckinPhotoUrls,
  type ChecklistItemRow,
  type CustomItemRow,
} from "@/lib/supabase/checklist";
import {
  mapCellParticipantRpcRow,
  mapCustomTitleStatRow,
  parseExpandDensityPhotoJson,
  type CellParticipant,
  type CustomTitleStatRow,
  type TemplateItemStatRow,
} from "@/lib/supabase/leaderboardActionHeatmap";

export async function fetchGroupDefaultTemplateItemStatsForRange(
  groupId: string,
  start: string,
  end: string,
): Promise<TemplateItemStatRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_default_template_item_stats",
    { p_group_id: groupId, p_start: start, p_end: end },
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
    sdgIds: Array.isArray(r.sdg_ids)
      ? r.sdg_ids.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 17)
      : [],
  }));
}

export async function fetchGroupCustomTitleStatsForRange(
  groupId: string,
  start: string,
  end: string,
  limit = 40,
): Promise<CustomTitleStatRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_group_custom_title_stats", {
    p_group_id: groupId,
    p_start: start,
    p_end: end,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as Record<string, unknown>[] | null)?.map(mapCustomTitleStatRow) ?? [];
}

export async function fetchGroupTemplateItemDayDensityMapForRange(
  groupId: string,
  start: string,
  end: string,
  itemId: string,
): Promise<Map<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_template_item_day_density",
    {
      p_group_id: groupId,
      p_start: start,
      p_end: end,
      p_item_id: itemId,
    },
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

export async function fetchGroupTemplateItemExpandForRange(
  groupId: string,
  start: string,
  end: string,
  itemId: string,
): Promise<{ densityMap: Map<string, number>; photoDates: Set<string> }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_template_item_day_density_and_photo_dates",
    {
      p_group_id: groupId,
      p_start: start,
      p_end: end,
      p_item_id: itemId,
    },
  );
  if (error) throw error;
  return parseExpandDensityPhotoJson(data, "participant_count");
}

export async function fetchGroupCustomTitleExpandForRange(
  groupId: string,
  start: string,
  end: string,
  title: string,
): Promise<{ densityMap: Map<string, number>; photoDates: Set<string> }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_custom_title_day_density_and_photo_dates",
    {
      p_group_id: groupId,
      p_start: start,
      p_end: end,
      p_title: title,
    },
  );
  if (error) throw error;
  return parseExpandDensityPhotoJson(data, "checkin_count");
}

export async function fetchGroupCustomTitleDayDensityMapForRange(
  groupId: string,
  start: string,
  end: string,
  title: string,
): Promise<Map<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_custom_title_day_density",
    {
      p_group_id: groupId,
      p_start: start,
      p_end: end,
      p_title: title,
    },
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

export async function fetchGroupTemplateItemCellParticipants(
  groupId: string,
  date: string,
  itemId: string,
): Promise<CellParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_template_item_cell_participants",
    { p_group_id: groupId, p_date: date, p_item_id: itemId },
  );
  if (error) throw error;
  const rows = data as
    | {
        user_id: string;
        nickname: string;
        photo_url: string | null;
        photo_urls?: unknown;
        avatar_url?: string | null;
      }[]
    | null;
  return (rows ?? []).map(mapCellParticipantRpcRow);
}

export async function fetchGroupCustomTitleCellParticipants(
  groupId: string,
  date: string,
  title: string,
): Promise<CellParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_custom_title_cell_participants",
    { p_group_id: groupId, p_date: date, p_title: title },
  );
  if (error) throw error;
  const rows = data as
    | {
        user_id: string;
        nickname: string;
        photo_url: string | null;
        photo_urls?: unknown;
        avatar_url?: string | null;
      }[]
    | null;
  return (rows ?? []).map(mapCellParticipantRpcRow);
}

export async function fetchGroupPhotoDatesSetForRange(
  groupId: string,
  start: string,
  end: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_group_photo_dates_in_range", {
    p_group_id: groupId,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  const rows = data as { d: string }[] | null;
  const out = new Set<string>();
  for (const r of rows ?? []) {
    const k = typeof r.d === "string" ? r.d : String(r.d).slice(0, 10);
    out.add(k);
  }
  return out;
}

export async function fetchGroupTemplateItemPhotoDatesSetForRange(
  groupId: string,
  start: string,
  end: string,
  itemId: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_template_item_day_photo_dates",
    {
      p_group_id: groupId,
      p_start: start,
      p_end: end,
      p_item_id: itemId,
    },
  );
  if (error) throw error;
  const rows = data as { d: string }[] | null;
  const out = new Set<string>();
  for (const r of rows ?? []) {
    const k = typeof r.d === "string" ? r.d : String(r.d).slice(0, 10);
    out.add(k);
  }
  return out;
}

export async function fetchGroupCustomTitlePhotoDatesSetForRange(
  groupId: string,
  start: string,
  end: string,
  title: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_group_custom_title_day_photo_dates",
    {
      p_group_id: groupId,
      p_start: start,
      p_end: end,
      p_title: title,
    },
  );
  if (error) throw error;
  const rows = data as { d: string }[] | null;
  const out = new Set<string>();
  for (const r of rows ?? []) {
    const k = typeof r.d === "string" ? r.d : String(r.d).slice(0, 10);
    out.add(k);
  }
  return out;
}

export type GroupPeerDaySnapshotParsed = {
  stats: {
    completed_count: number;
    total_items: number;
    raw_score: number;
    normalized_score: number;
    streak: number;
    sdg_coverage: number;
  } | null;
  items: ChecklistItemRow[];
  customItems: CustomItemRow[];
  checkinItemIds: Set<string>;
  checkinCustomIds: Set<string>;
  photoByItemId: Record<string, string[]>;
  photoByCustomId: Record<string, string[]>;
};

function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function fetchGroupPeerDaySnapshot(
  groupId: string,
  peerUserId: string,
  date: string,
): Promise<GroupPeerDaySnapshotParsed | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_group_peer_day_snapshot", {
    p_group_id: groupId,
    p_peer_user_id: peerUserId,
    p_date: date,
  });
  if (error) throw error;
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  let stats: GroupPeerDaySnapshotParsed["stats"] = null;
  const rawStats = o.stats;
  if (rawStats && typeof rawStats === "object") {
    const s = rawStats as Record<string, unknown>;
    stats = {
      completed_count: num(s.completed_count),
      total_items: num(s.total_items),
      raw_score: num(s.raw_score),
      normalized_score: num(s.normalized_score),
      streak: num(s.streak),
      sdg_coverage: num(s.sdg_coverage),
    };
  }

  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items: ChecklistItemRow[] = itemsRaw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      template_id: String(r.template_id ?? ""),
      title: String(r.title ?? ""),
      description: r.description != null ? String(r.description) : null,
      sdg_ids: Array.isArray(r.sdg_ids)
        ? r.sdg_ids.filter((x): x is number => Number.isInteger(x))
        : [],
      points: num(r.points, 10),
      is_active: r.is_active !== false,
      order: num(r.sort_order, 0),
    };
  });

  const customRaw = Array.isArray(o.custom_items) ? o.custom_items : [];
  const customItems: CustomItemRow[] = customRaw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      title: String(r.title ?? ""),
      sdg_ids: Array.isArray(r.sdg_ids)
        ? r.sdg_ids.filter((x): x is number => Number.isInteger(x))
        : [],
      points: num(r.points, 10),
      is_favorite: Boolean(r.is_favorite),
    };
  });

  const checkinsRaw = Array.isArray(o.checkins) ? o.checkins : [];
  const checkinItemIds = new Set<string>();
  const checkinCustomIds = new Set<string>();
  const photoByItemId: Record<string, string[]> = {};
  const photoByCustomId: Record<string, string[]> = {};
  for (const row of checkinsRaw) {
    const r = row as Record<string, unknown>;
    const urls = normalizeCheckinPhotoUrls({
      photo_url:
        typeof r.photo_url === "string" ? r.photo_url : null,
      photo_urls: r.photo_urls,
    });
    if (r.item_id) {
      const id = String(r.item_id);
      checkinItemIds.add(id);
      if (urls.length > 0) photoByItemId[id] = urls;
    }
    if (r.custom_item_id) {
      const id = String(r.custom_item_id);
      checkinCustomIds.add(id);
      if (urls.length > 0) photoByCustomId[id] = urls;
    }
  }

  return {
    stats,
    items,
    customItems,
    checkinItemIds,
    checkinCustomIds,
    photoByItemId,
    photoByCustomId,
  };
}
