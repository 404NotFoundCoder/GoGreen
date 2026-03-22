"use client";

import { useAuthContext } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  fetchProfileCustomTitleStatsForRange,
  fetchProfileTemplateItemStatsForRange,
  type CustomTitleStatRow,
  type TemplateItemStatRow,
} from "@/lib/supabase/leaderboardActionHeatmap";
import { useCallback, useEffect, useState } from "react";

/** 個人頁「各項完成率」：僅本人，起訖同全體榜之今日／本週／本月／自訂。 */
export function useProfileActionCompletionStats(range: {
  start: string;
  end: string;
}) {
  const { start, end } = range;
  const { user } = useAuthContext();
  const [templateRows, setTemplateRows] = useState<TemplateItemStatRow[]>([]);
  const [customRows, setCustomRows] = useState<CustomTitleStatRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listSilentEpoch, setListSilentEpoch] = useState(0);

  const loadList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user?.id) {
        setTemplateRows([]);
        setCustomRows([]);
        setLoadingList(false);
        return;
      }
      if (!opts?.silent) setLoadingList(true);
      setListError(null);
      try {
        const [t, c] = await Promise.all([
          fetchProfileTemplateItemStatsForRange(start, end),
          fetchProfileCustomTitleStatsForRange(start, end, 40),
        ]);
        setTemplateRows(t);
        setCustomRows(c);
        if (opts?.silent) setListSilentEpoch((e) => e + 1);
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!opts?.silent) setLoadingList(false);
      }
    },
    [start, end, user?.id],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const ch = supabase
      .channel("profile-action-completion")
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
    listSilentEpoch,
    refetchList: loadList,
  };
}
