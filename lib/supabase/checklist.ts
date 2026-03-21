import { DEFAULT_TEMPLATE_ID } from "@/constants/checklist";
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
