"use client";

import { useAuthContext } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  fetchGroupCustomTitleStatsForRange,
  fetchGroupDefaultTemplateItemStatsForRange,
} from "@/lib/supabase/groupRecords";
import type {
  CustomTitleStatRow,
  TemplateItemStatRow,
} from "@/lib/supabase/leaderboardActionHeatmap";
import { useCallback, useEffect, useState } from "react";

/** 群組內「各項完成率」列表（僅限同群成員之統計） */
export function useGroupActionCompletionStats(
  groupId: string | null,
  range: { start: string; end: string },
) {
  const { start, end } = range;
  const { user } = useAuthContext();
  const [templateRows, setTemplateRows] = useState<TemplateItemStatRow[]>([]);
  const [customRows, setCustomRows] = useState<CustomTitleStatRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!groupId) {
        setTemplateRows([]);
        setCustomRows([]);
        if (!opts?.silent) setLoadingList(false);
        return;
      }
      if (!opts?.silent) setLoadingList(true);
      setListError(null);
      try {
        const [t, c] = await Promise.all([
          fetchGroupDefaultTemplateItemStatsForRange(groupId, start, end),
          fetchGroupCustomTitleStatsForRange(groupId, start, end, 40),
        ]);
        setTemplateRows(t);
        setCustomRows(c);
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!opts?.silent) setLoadingList(false);
      }
    },
    [groupId, start, end],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!user || !groupId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`group-action-completion-${groupId}`)
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
  }, [user, groupId, loadList]);

  return {
    templateRows,
    customRows,
    loadingList,
    listError,
    refetchList: loadList,
  };
}
