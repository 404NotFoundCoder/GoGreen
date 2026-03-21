"use client";

import { fetchGlobalLeaderboard } from "@/lib/supabase/leaderboard";
import type { LeaderboardDimension, LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export function useGlobalLeaderboard(
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
) {
  const { user } = useAuthContext();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchGlobalLeaderboard>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const rows = await fetchGlobalLeaderboard(period, dimension);
        setData(rows);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [period, dimension],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const ch = supabase
      .channel("global-lb")
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
  }, [user, load]);

  return { data, loading, error, refetch: load };
}
