import { DEFAULT_TEMPLATE_ID } from "@/constants/checklist";
import { MAX_CUSTOM_ITEMS, MAX_FAVORITE_ITEMS } from "@/constants/config";
import { DEFAULT_ITEM_POINTS } from "@/constants/scoring";
import { createClient } from "@/lib/supabase/client";

export type ChecklistItemRow = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  sdg_ids: number[];
  points: number;
  is_active: boolean;
  order?: number;
};

export type CustomItemRow = {
  id: string;
  title: string;
  sdg_ids: number[];
  points: number;
  is_favorite: boolean;
};

export async function getUserTemplateId(userId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_user_template_id", {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data as string | null) ?? DEFAULT_TEMPLATE_ID;
}

export async function fetchActiveChecklistItems(
  templateId: string,
): Promise<ChecklistItemRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("template_id", templateId)
    .eq("is_active", true)
    .order("order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChecklistItemRow[];
}

export async function fetchTodayCheckins(userId: string, date: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("id, item_id, custom_item_id, photo_url")
    .eq("user_id", userId)
    .eq("date", date);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTodayCustomRows(userId: string, date: string) {
  const supabase = createClient();
  const { data: links, error } = await supabase
    .from("user_daily_custom_items")
    .select("custom_item_id")
    .eq("user_id", userId)
    .eq("date", date);
  if (error) throw error;
  const ids = (links ?? []).map((l) => l.custom_item_id as string);
  if (ids.length === 0) return [];
  const { data: items, error: e2 } = await supabase
    .from("custom_items")
    .select("id, title, sdg_ids, points, is_favorite")
    .in("id", ids);
  if (e2) throw e2;
  return items ?? [];
}

export async function countTodayCustomSlots(userId: string, date: string) {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("user_daily_custom_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("date", date);
  if (error) throw error;
  return count ?? 0;
}

export async function setPublicItemDone(args: {
  userId: string;
  date: string;
  itemId: string;
  done: boolean;
}) {
  const supabase = createClient();
  if (args.done) {
    const { error } = await supabase.from("daily_checkins").insert({
      user_id: args.userId,
      date: args.date,
      item_id: args.itemId,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("daily_checkins")
      .delete()
      .eq("user_id", args.userId)
      .eq("date", args.date)
      .eq("item_id", args.itemId);
    if (error) throw error;
  }
}

export async function setCustomItemDone(args: {
  userId: string;
  date: string;
  customItemId: string;
  done: boolean;
}) {
  const supabase = createClient();
  if (args.done) {
    const { error } = await supabase.from("daily_checkins").insert({
      user_id: args.userId,
      date: args.date,
      custom_item_id: args.customItemId,
    });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("daily_checkins")
      .delete()
      .eq("user_id", args.userId)
      .eq("date", args.date)
      .eq("custom_item_id", args.customItemId);
    if (error) throw error;
  }
}

export async function addCustomItemForToday(args: {
  userId: string;
  date: string;
  title: string;
  sdgIds: number[];
  isFavorite: boolean;
}) {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("custom_items")
    .insert({
      user_id: args.userId,
      title: args.title.trim(),
      sdg_ids: args.sdgIds,
      points: DEFAULT_ITEM_POINTS,
      is_favorite: args.isFavorite,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: e2 } = await supabase.from("user_daily_custom_items").insert({
    user_id: args.userId,
    date: args.date,
    custom_item_id: row!.id,
  });
  if (e2) throw e2;
  return row!.id as string;
}

export async function countUserFavoriteItems(userId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("custom_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_favorite", true);
  if (error) throw error;
  return count ?? 0;
}

/** 僅收藏、不加入今日清單（③） */
export async function addCustomItemFavoriteOnly(args: {
  userId: string;
  title: string;
  sdgIds: number[];
}): Promise<string> {
  const n = await countUserFavoriteItems(args.userId);
  if (n >= MAX_FAVORITE_ITEMS) {
    throw new Error(`常用收藏已達上限（${MAX_FAVORITE_ITEMS}）`);
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("custom_items")
    .insert({
      user_id: args.userId,
      title: args.title.trim(),
      sdg_ids: args.sdgIds,
      points: DEFAULT_ITEM_POINTS,
      is_favorite: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

/** 常用清單：所有 is_favorite 的自訂項目 */
export async function fetchFavoriteCustomItems(
  userId: string,
): Promise<CustomItemRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("custom_items")
    .select("id, title, sdg_ids, points, is_favorite")
    .eq("user_id", userId)
    .eq("is_favorite", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomItemRow[];
}

/** 自今日清單移除連結（不刪除 `custom_items`；若曾打卡則一併刪除當日 checkin） */
export async function unlinkCustomItemFromToday(args: {
  userId: string;
  date: string;
  customItemId: string;
}): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("daily_checkins")
    .delete()
    .eq("user_id", args.userId)
    .eq("date", args.date)
    .eq("custom_item_id", args.customItemId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("user_daily_custom_items")
    .delete()
    .eq("user_id", args.userId)
    .eq("date", args.date)
    .eq("custom_item_id", args.customItemId);
  if (e2) throw e2;
}

/** 更新自訂項目（同一筆 `custom_items`；今日列與常用列會一併顯示新內容） */
export async function updateCustomItem(args: {
  userId: string;
  customItemId: string;
  title: string;
  sdgIds: number[];
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("custom_items")
    .update({
      title: args.title.trim(),
      sdg_ids: args.sdgIds,
    })
    .eq("user_id", args.userId)
    .eq("id", args.customItemId);
  if (error) throw error;
}

/** 刪除自訂項目（所有日期的打卡與今日連結一併清除；收藏／今日皆適用） */
export async function deleteCustomItemById(args: {
  userId: string;
  customItemId: string;
}): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("daily_checkins")
    .delete()
    .eq("user_id", args.userId)
    .eq("custom_item_id", args.customItemId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("user_daily_custom_items")
    .delete()
    .eq("user_id", args.userId)
    .eq("custom_item_id", args.customItemId);
  if (e2) throw e2;
  const { error: e3 } = await supabase
    .from("custom_items")
    .delete()
    .eq("user_id", args.userId)
    .eq("id", args.customItemId);
  if (e3) throw e3;
}

/** 將既有自訂項目加入「今日」連結 */
export async function linkCustomItemToToday(args: {
  userId: string;
  date: string;
  customItemId: string;
}): Promise<void> {
  const slots = await countTodayCustomSlots(args.userId, args.date);
  if (slots >= MAX_CUSTOM_ITEMS) {
    throw new Error(`今日自訂項目已達上限（${MAX_CUSTOM_ITEMS}）`);
  }
  const supabase = createClient();
  const { error } = await supabase.from("user_daily_custom_items").insert({
    user_id: args.userId,
    date: args.date,
    custom_item_id: args.customItemId,
  });
  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}

const CHECKIN_PHOTOS_BUCKET = "checkin-photos";

export async function uploadCheckinPhotoFile(args: {
  userId: string;
  date: string;
  file: File;
  itemId?: string;
  customItemId?: string;
}): Promise<string> {
  const supabase = createClient();
  const key = args.itemId ?? args.customItemId;
  if (!key) throw new Error("缺少 itemId 或 customItemId");
  const ext =
    args.file.name.split(".").pop()?.toLowerCase() === "png"
      ? "png"
      : args.file.type === "image/png"
        ? "png"
        : "jpg";
  const path = `${args.userId}/${args.date}_${key}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(CHECKIN_PHOTOS_BUCKET)
    .upload(path, args.file, { upsert: true, contentType: args.file.type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage
    .from(CHECKIN_PHOTOS_BUCKET)
    .getPublicUrl(path);
  const photoUrl = pub.publicUrl;

  let q = supabase
    .from("daily_checkins")
    .update({ photo_url: photoUrl })
    .eq("user_id", args.userId)
    .eq("date", args.date);
  if (args.itemId) {
    q = q.eq("item_id", args.itemId).is("custom_item_id", null);
  } else {
    q = q.eq("custom_item_id", args.customItemId!).is("item_id", null);
  }
  const { error: uErr } = await q;
  if (uErr) throw uErr;
  return photoUrl;
}

/** 區間內每日：當日連結的自訂格數、已完成自訂打卡數、是否有佐證圖 */
export async function fetchUserDayActivityExtrasInRange(
  userId: string,
  from: string,
  to: string,
): Promise<
  Map<
    string,
    { customTotal: number; customDone: number; hasPhoto: boolean }
  >
> {
  const supabase = createClient();
  const { data: checkins, error: e1 } = await supabase
    .from("daily_checkins")
    .select("date, custom_item_id, photo_url")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  if (e1) throw e1;
  const { data: links, error: e2 } = await supabase
    .from("user_daily_custom_items")
    .select("date")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  if (e2) throw e2;

  const m = new Map<
    string,
    { customTotal: number; customDone: number; hasPhoto: boolean }
  >();
  const ensure = (d: string) => {
    if (!m.has(d)) {
      m.set(d, { customTotal: 0, customDone: 0, hasPhoto: false });
    }
    return m.get(d)!;
  };
  for (const l of links ?? []) {
    const d = String(l.date).slice(0, 10);
    ensure(d).customTotal += 1;
  }
  for (const c of checkins ?? []) {
    const d = String(c.date).slice(0, 10);
    const row = ensure(d);
    if (c.custom_item_id) row.customDone += 1;
    if (c.photo_url) row.hasPhoto = true;
  }
  return m;
}

/** 清空該日所有打卡與「今日」自訂連結（不刪除 `custom_items` 本體） */
export async function clearUserCalendarDay(args: {
  userId: string;
  date: string;
}): Promise<void> {
  const supabase = createClient();
  const { error: e1 } = await supabase
    .from("daily_checkins")
    .delete()
    .eq("user_id", args.userId)
    .eq("date", args.date);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("user_daily_custom_items")
    .delete()
    .eq("user_id", args.userId)
    .eq("date", args.date);
  if (e2) throw e2;
}
