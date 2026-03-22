"use client";

import { useAuthContext } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCustomTitleStats,
  fetchDefaultTemplateItemStats,
  type CustomTitleStatRow,
  type TemplateItemStatRow,
} from "@/lib/supabase/leaderboardActionHeatmap";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { useCallback, useEffect, useState } from "react";

/**
 * 全體榜「各項完成率」公版／自訂列表資料。
 * 登入時訂閱 Realtime（與主榜單僅聽 user_daily_stats 互補），以便打卡、列入今日清單變動後自動重抓。
 */
export function useGlobalActionCompletionStats(period: LeaderboardPeriod) {
  const { user } = useAuthContext();
  const [templateRows, setTemplateRows] = useState<TemplateItemStatRow[]>([]);
  const [customRows, setCustomRows] = useState<CustomTitleStatRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingList(true);
      setListError(null);
      try {
        const [t, c] = await Promise.all([
          fetchDefaultTemplateItemStats(period),
          fetchCustomTitleStats(period, 40),
        ]);
        setTemplateRows(t);
        setCustomRows(c);
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!opts?.silent) setLoadingList(false);
      }
    },
    [period],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const ch = supabase
      .channel("global-action-completion")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_checkins" },
        () => {
          void loadList({ silent: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_daily_custom_items" },
        () => {
          void loadList({ silent: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_daily_stats" },
        () => {
          void loadList({ silent: true });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, loadList]);

  return {
    templateRows,
    customRows,
    loadingList,
    listError,
    refetchList: loadList,
  };
}
