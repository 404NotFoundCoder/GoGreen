"use client";

import { periodScopeLabel } from "@/components/leaderboard/LeaderboardPeriodBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthContext } from "@/context/AuthContext";
import { fetchUserDailyStatsInRange } from "@/lib/supabase/stats";
import { getLeaderboardDateBounds } from "@/lib/utils/leaderboardPeriod";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { Leaf } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export function ProfileDailyStats({ period }: { period: LeaderboardPeriod }) {
  const { user, loading: authLoading } = useAuthContext();
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof fetchUserDailyStatsInRange>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [useCustomRange, setUseCustomRange] = useState(false);

  const pl = periodScopeLabel(period);

  const { rangeFrom, rangeTo } = useMemo(() => {
    if (
      useCustomRange &&
      customFrom &&
      customTo &&
      customFrom <= customTo
    ) {
      return { rangeFrom: customFrom, rangeTo: customTo };
    }
    const b = getLeaderboardDateBounds(period);
    return { rangeFrom: b.start, rangeTo: b.end };
  }, [period, useCustomRange, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!user) {
      setRows(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserDailyStatsInRange(
        user.id,
        rangeFrom,
        rangeTo,
      );
      setRows([...data].reverse());
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [user, rangeFrom, rangeTo]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const rangeLabel = useCustomRange
    ? `${rangeFrom}～${rangeTo}`
    : `「${pl}」`;

  if (!authLoading && !user) {
    return null;
  }

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">
        每日紀錄（{rangeLabel}）
      </h2>
      <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
        依每日統計（有打卡的日期才會出現）。點日期可開啟「今日」頁面；歷史檢視將依網址參數擴充。
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-muted)]/60 bg-[var(--color-white)]/50 p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-ink-secondary)]">
            自訂起日
          </span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border border-[var(--color-muted)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-ink)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-ink-secondary)]">
            自訖日
          </span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-[var(--color-muted)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-ink)]"
          />
        </label>
        <button
          type="button"
          disabled={!customFrom || !customTo || customFrom > customTo}
          onClick={() => setUseCustomRange(true)}
          className="rounded-full border border-[var(--color-primary-strong)]/40 bg-[var(--color-primary-light)]/50 px-4 py-2 text-sm font-medium text-[var(--color-ink)] disabled:opacity-40"
        >
          套用自訂範圍
        </button>
        <button
          type="button"
          onClick={() => {
            setUseCustomRange(false);
            setCustomFrom("");
            setCustomTo("");
          }}
          className="rounded-full border border-[var(--color-muted)] px-4 py-2 text-sm text-[var(--color-ink-secondary)]"
        >
          還原為上方時間範圍
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
          無法載入紀錄：{error.message}
        </p>
      ) : null}

      {loading || authLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : !rows?.length ? (
        <p className="mt-4 text-sm text-[var(--color-ink-secondary)]">
          此區間尚無打卡紀錄。
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-sm">
            <thead>
              <tr className="border-b-[0.5px] border-[var(--color-muted)] text-left text-[var(--color-ink-secondary)]">
                <th className="py-2 pr-2 font-medium">日期</th>
                <th className="py-2 pr-2 font-medium">進度</th>
                <th className="py-2 pr-2 font-medium">得分</th>
                <th className="py-2 font-medium">連續</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const full =
                  r.total_items > 0 &&
                  r.completed_count >= r.total_items;
                const extra =
                  r.total_items > 0 && r.completed_count > r.total_items
                    ? r.completed_count - r.total_items
                    : 0;
                return (
                  <tr
                    key={r.date}
                    className="border-b-[0.5px] border-[var(--color-muted)]/60"
                  >
                    <td className="py-2 pr-2">
                      <Link
                        href={`/today?date=${r.date}`}
                        className="tabular-nums font-medium text-[var(--color-primary-dark)] underline-offset-2 hover:underline"
                      >
                        {r.date}
                      </Link>
                    </td>
                    <td className="py-2 pr-2">
                      <span className="inline-flex flex-wrap items-center gap-1.5 tabular-nums text-[var(--color-ink)]">
                        <span>
                          {r.completed_count}/{r.total_items}
                        </span>
                        {full ? (
                          <span title="當日清單全完成">
                            <Leaf
                              className="h-4 w-4 shrink-0 text-emerald-600"
                              strokeWidth={2}
                              aria-hidden
                            />
                          </span>
                        ) : null}
                        {extra > 0 ? (
                          <span className="text-[11px] text-[var(--color-subtle)]">
                            額外 +{extra} 項
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                      {r.raw_score}
                    </td>
                    <td className="py-2 tabular-nums text-[var(--color-ink)]">
                      {r.streak} 天
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
