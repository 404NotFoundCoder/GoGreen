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
import { useCallback, useEffect, useRef, useState } from "react";

function countDoneToday(
  items: ChecklistItemRow[],
  customItems: CustomItemRow[],
  itemIds: Set<string>,
  customIds: Set<string>,
): number {
  return (
    items.filter((i) => itemIds.has(i.id)).length +
    customItems.filter((c) => customIds.has(c.id)).length
  );
}

export type TodayStats = {
  completed_count: number;
  total_items: number;
  raw_score: number;
  normalized_score: number;
  streak: number;
  sdg_coverage: number;
} | null;

export function useTodayChecklist() {
  const { user, loading: authLoading } = useAuthContext();
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
  /** 僅阻擋「同一列」重複送出；不同列可並行，避免快速連點時被略過 */
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(
    () => new Set(),
  );
  const pendingTogglesRef = useRef<Set<string>>(new Set());

  /** 僅在使用者 toggle 成功、由「未全完成」變成「全完成」時遞增（初始讀取已全完成不會 +1） */
  const [fullCompletionCelebrationTick, setFullCompletionCelebrationTick] =
    useState(0);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (!opts?.silent) {
        setLoading(true);
      }
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
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [user, date],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [user, authLoading, load]);

  const togglePublic = async (itemId: string) => {
    const key = `p:${itemId}`;
    if (!user || pendingTogglesRef.current.has(key)) return;
    pendingTogglesRef.current.add(key);
    setPendingToggles(new Set(pendingTogglesRef.current));
    const done = checkinItemIds.has(itemId);
    const nextDone = !done;
    const totalSlots = items.length + customItems.length;
    const doneCountBefore = countDoneToday(
      items,
      customItems,
      checkinItemIds,
      checkinCustomIds,
    );
    const nextItemIds = new Set(checkinItemIds);
    if (nextDone) nextItemIds.add(itemId);
    else nextItemIds.delete(itemId);
    const doneCountAfter = countDoneToday(
      items,
      customItems,
      nextItemIds,
      checkinCustomIds,
    );
    const allDoneBefore = totalSlots > 0 && doneCountBefore === totalSlots;
    const allDoneAfter = totalSlots > 0 && doneCountAfter === totalSlots;
    const crossedFullCompletion =
      nextDone && !allDoneBefore && allDoneAfter;

    setCheckinItemIds((prev) => {
      const s = new Set(prev);
      if (nextDone) s.add(itemId);
      else s.delete(itemId);
      return s;
    });
    try {
      await setPublicItemDone({
        userId: user.id,
        date,
        itemId,
        done: nextDone,
      });
      await load({ silent: true });
      if (crossedFullCompletion) {
        setFullCompletionCelebrationTick((n) => n + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      await load({ silent: true });
    } finally {
      pendingTogglesRef.current.delete(key);
      setPendingToggles(new Set(pendingTogglesRef.current));
    }
  };

  const toggleCustom = async (customItemId: string) => {
    const key = `c:${customItemId}`;
    if (!user || pendingTogglesRef.current.has(key)) return;
    pendingTogglesRef.current.add(key);
    setPendingToggles(new Set(pendingTogglesRef.current));
    const done = checkinCustomIds.has(customItemId);
    const nextDone = !done;
    const totalSlots = items.length + customItems.length;
    const doneCountBefore = countDoneToday(
      items,
      customItems,
      checkinItemIds,
      checkinCustomIds,
    );
    const nextCustomIds = new Set(checkinCustomIds);
    if (nextDone) nextCustomIds.add(customItemId);
    else nextCustomIds.delete(customItemId);
    const doneCountAfter = countDoneToday(
      items,
      customItems,
      checkinItemIds,
      nextCustomIds,
    );
    const allDoneBefore = totalSlots > 0 && doneCountBefore === totalSlots;
    const allDoneAfter = totalSlots > 0 && doneCountAfter === totalSlots;
    const crossedFullCompletion =
      nextDone && !allDoneBefore && allDoneAfter;

    setCheckinCustomIds((prev) => {
      const s = new Set(prev);
      if (nextDone) s.add(customItemId);
      else s.delete(customItemId);
      return s;
    });
    try {
      await setCustomItemDone({
        userId: user.id,
        date,
        customItemId,
        done: nextDone,
      });
      await load({ silent: true });
      if (crossedFullCompletion) {
        setFullCompletionCelebrationTick((n) => n + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      await load({ silent: true });
    } finally {
      pendingTogglesRef.current.delete(key);
      setPendingToggles(new Set(pendingTogglesRef.current));
    }
  };

  const addCustom = async (
    title: string,
    sdgIds: number[],
    favorite: boolean,
  ) => {
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
    await load({ silent: true });
  };

  const totalSlots = items.length + customItems.length;
  const doneCount =
    items.filter((i) => checkinItemIds.has(i.id)).length +
    customItems.filter((c) => checkinCustomIds.has(c.id)).length;
  const allDone = totalSlots > 0 && doneCount === totalSlots;

  const showSkeleton = loading || authLoading;

  return {
    date,
    templateId,
    items,
    customItems,
    checkinItemIds,
    checkinCustomIds,
    stats,
    loading: showSkeleton,
    error,
    refetch: load,
    togglePublic,
    toggleCustom,
    addCustom,
    totalSlots,
    doneCount,
    allDone,
    /** 僅在使用者本次操作剛好打滿檢核時遞增；用於觸發全完成慶祝，不含初次載入已全滿 */
    fullCompletionCelebrationTick,
    pendingToggles,
  };
}
