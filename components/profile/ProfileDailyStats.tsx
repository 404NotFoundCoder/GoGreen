"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthContext } from "@/context/AuthContext";
import { fetchUserDailyStatsRecent } from "@/lib/supabase/stats";
import { useCallback, useEffect, useState } from "react";

const DAYS = 14;

export function ProfileDailyStats() {
  const { user, loading: authLoading } = useAuthContext();
  const [rows, setRows] = useState<Awaited<
    ReturnType<typeof fetchUserDailyStatsRecent>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRows(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserDailyStatsRecent(user.id, DAYS);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  if (authLoading || loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (error) {
    return (
      <p className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink)]">
        無法載入近況：{error.message}
      </p>
    );
  }

  if (!rows?.length) {
    return (
      <div className="rounded-2xl border-[0.5px] border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink-secondary)]">
        最近 {DAYS} 天尚無打卡紀錄；完成今日檢核後會顯示於此。
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">
        近 {DAYS} 天紀錄
      </h2>
      <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
        依每日統計（有打卡的日期才會出現）。
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr className="border-b-[0.5px] border-[var(--color-muted)] text-left text-[var(--color-ink-secondary)]">
              <th className="py-2 pr-2 font-medium">日期</th>
              <th className="py-2 pr-2 font-medium">進度</th>
              <th className="py-2 pr-2 font-medium">得分</th>
              <th className="py-2 font-medium">連續</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.date}
                className="border-b-[0.5px] border-[var(--color-muted)]/60"
              >
                <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                  {r.date}
                </td>
                <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                  {r.completed_count}/{r.total_items}
                </td>
                <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                  {r.raw_score}
                </td>
                <td className="py-2 tabular-nums text-[var(--color-ink)]">
                  {r.streak} 天
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
