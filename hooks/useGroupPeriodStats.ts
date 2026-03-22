"use client";

import { fetchGroupPeriodStats } from "@/lib/supabase/leaderboard";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export function useGroupPeriodStats(
  groupId: string | null,
  period: LeaderboardPeriod,
  enabled: boolean,
) {
  const { user } = useAuthContext();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchGroupPeriodStats>
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
        const result = await fetchGroupPeriodStats(groupId, period);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [groupId, period, enabled],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || !enabled || !groupId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`group-stats-${groupId}`)
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
  }, [user, groupId, enabled, load]);

  return { data, loading, error, refetch: load };
}
