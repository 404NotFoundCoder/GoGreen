"use client";

import { fetchGroupLeaderboardCharts } from "@/lib/supabase/leaderboardAnalytics";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export function useGroupLeaderboardCharts(
  period: LeaderboardPeriod,
  enabled: boolean,
  groupId: string | null,
) {
  const { user } = useAuthContext();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchGroupLeaderboardCharts>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled || !groupId) {
        setData(null);
        if (!opts?.silent) setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const result = await fetchGroupLeaderboardCharts(groupId, period);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [period, enabled, groupId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || !enabled || !groupId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`group-charts-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_daily_stats" },
        () => {
          void load({ silent: true });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, enabled, groupId, load]);

  return { data, loading, error, refetch: load };
}
