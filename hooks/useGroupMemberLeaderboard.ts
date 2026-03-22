"use client";

import { fetchGroupMemberLeaderboard } from "@/lib/supabase/leaderboard";
import type { LeaderboardDimension, LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export function useGroupMemberLeaderboard(
  groupId: string | null,
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
  page: number,
) {
  const { user } = useAuthContext();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchGroupMemberLeaderboard>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!groupId) {
        setData(null);
        if (!opts?.silent) setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const result = await fetchGroupMemberLeaderboard(
          groupId,
          period,
          dimension,
        );
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [groupId, period, dimension, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user || !groupId) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`group-lb-${groupId}`)
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
  }, [user, groupId, load]);

  return { data, loading, error, refetch: load };
}
