"use client";

import { fetchPersonalLeaderboardSnapshot } from "@/lib/supabase/leaderboard";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export function usePersonalLeaderboard(period: LeaderboardPeriod) {
  const { user } = useAuthContext();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchPersonalLeaderboardSnapshot>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user?.id) {
        setData(null);
        if (!opts?.silent) setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const result = await fetchPersonalLeaderboardSnapshot(user.id, period);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [user?.id, period],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const ch = supabase
      .channel("personal-lb")
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
