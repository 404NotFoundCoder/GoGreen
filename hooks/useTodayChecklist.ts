"use client";

import { MAX_CUSTOM_ITEMS } from "@/constants/config";
import {
  addCustomItemForToday,
  countTodayCustomSlots,
  fetchActiveChecklistItems,
  fetchTodayCheckins,
  fetchTodayCustomRows,
  getUserTemplateId,
  setCustomItemDone,
  setPublicItemDone,
  type ChecklistItemRow,
  type CustomItemRow,
} from "@/lib/supabase/checklist";
import { fetchUserDailyStatsForDate } from "@/lib/supabase/stats";
import { getTodayString } from "@/lib/utils/date";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export type TodayStats = {
  completed_count: number;
  total_items: number;
  raw_score: number;
  normalized_score: number;
  streak: number;
  sdg_coverage: number;
} | null;

export function useTodayChecklist() {
  const { user } = useAuthContext();
  const date = getTodayString();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [items, setItems] = useState<ChecklistItemRow[]>([]);
  const [customItems, setCustomItems] = useState<CustomItemRow[]>([]);
  const [checkinItemIds, setCheckinItemIds] = useState<Set<string>>(new Set());
  const [checkinCustomIds, setCheckinCustomIds] = useState<Set<string>>(
    new Set(),
  );
  const [stats, setStats] = useState<TodayStats>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tid = await getUserTemplateId(user.id);
      setTemplateId(tid);
      const [list, checkins, customs, st] = await Promise.all([
        fetchActiveChecklistItems(tid),
        fetchTodayCheckins(user.id, date),
        fetchTodayCustomRows(user.id, date),
        fetchUserDailyStatsForDate(user.id, date),
      ]);
      setItems(list);
      setCustomItems(customs as CustomItemRow[]);
      const itemDone = new Set<string>();
      const customDone = new Set<string>();
      for (const c of checkins) {
        if (c.item_id) itemDone.add(c.item_id as string);
        if (c.custom_item_id) customDone.add(c.custom_item_id as string);
      }
      setCheckinItemIds(itemDone);
      setCheckinCustomIds(customDone);
      setStats(
        st
          ? {
              completed_count: st.completed_count as number,
              total_items: st.total_items as number,
              raw_score: st.raw_score as number,
              normalized_score: Number(st.normalized_score),
              streak: st.streak as number,
              sdg_coverage: st.sdg_coverage as number,
            }
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePublic = async (itemId: string) => {
    if (!user) return;
    const done = checkinItemIds.has(itemId);
    await setPublicItemDone({
      userId: user.id,
      date,
      itemId,
      done: !done,
    });
    await load();
  };

  const toggleCustom = async (customItemId: string) => {
    if (!user) return;
    const done = checkinCustomIds.has(customItemId);
    await setCustomItemDone({
      userId: user.id,
      date,
      customItemId,
      done: !done,
    });
    await load();
  };

  const addCustom = async (title: string, sdgIds: number[], favorite: boolean) => {
    if (!user) return;
    const slots = await countTodayCustomSlots(user.id, date);
    if (slots >= MAX_CUSTOM_ITEMS) {
      throw new Error(`今日自訂項目已達上限（${MAX_CUSTOM_ITEMS}）`);
    }
    await addCustomItemForToday({
      userId: user.id,
      date,
      title,
      sdgIds,
      isFavorite: favorite,
    });
    await load();
  };

  const totalSlots = items.length + customItems.length;
  const doneCount =
    items.filter((i) => checkinItemIds.has(i.id)).length +
    customItems.filter((c) => checkinCustomIds.has(c.id)).length;
  const allDone = totalSlots > 0 && doneCount === totalSlots;

  return {
    date,
    templateId,
    items,
    customItems,
    checkinItemIds,
    checkinCustomIds,
    stats,
    loading,
    error,
    refetch: load,
    togglePublic,
    toggleCustom,
    addCustom,
    totalSlots,
    doneCount,
    allDone,
  };
}
