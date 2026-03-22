"use client";

import { periodScopeLabel } from "@/components/leaderboard/LeaderboardPeriodBar";
import {
  GlobalDailyCompletionBars,
  SdgDistributionBars,
} from "@/components/leaderboard/LeaderboardViz";
import { ProfileRecordsSection } from "@/components/profile/ProfileRecordsSection";
import { useAuthContext } from "@/context/AuthContext";
import {
  fetchUserProfileCharts,
  type DailyChartMode,
} from "@/lib/supabase/leaderboardAnalytics";
import { Skeleton } from "@/components/ui/Skeleton";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { useCallback, useEffect, useState } from "react";

function profileScoreTitle(
  mode: DailyChartMode | undefined,
  pl: string,
): string {
  if (mode === "week_daily") return `分數表（個人·${pl}·每日）`;
  if (mode === "month_four_segments") return `分數表（個人·${pl}·四週）`;
  if (mode === "all_daily") return `分數表（個人·至今·每日）`;
  if (mode === "all_four_segments") return `分數表（個人·至今·四週）`;
  if (mode === "all_monthly") return `分數表（個人·至今·按月）`;
  if (mode === "all_yearly") return `分數表（個人·至今·按年）`;
  return `分數表（個人·${pl}）`;
}

function profileScoreSubtitle(mode: DailyChartMode | undefined): string {
  if (mode === "week_daily")
    return "本週一至今日，折線為每日個人原始分；無打卡日為 0。切換本週／本月／至今會重算。";
  if (mode === "month_four_segments")
    return "本月 1 日至今日均分四段（非自然週），每段為段內每日個人原始分加總。";
  if (mode === "all_daily")
    return "今年 1/1 起：未滿一週補齊該曆週 7 日逐日顯示；數值為個人當日原始分。";
  if (mode === "all_four_segments")
    return "今年至今 8～31 天：依日數均分四段，每段為段內個人原始分加總。";
  if (mode === "all_monthly")
    return "今年至今 32 天～一年：依曆月彙總個人原始分。";
  if (mode === "all_yearly") return "今年起算超過一年：依曆年彙總個人原始分。";
  return "";
}

export function ProfileChartsSection({
  period,
}: {
  period: LeaderboardPeriod;
}) {
  const { user, loading: authLoading } = useAuthContext();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchUserProfileCharts>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pl = periodScopeLabel(period);

  const load = useCallback(async () => {
    if (!user?.id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchUserProfileCharts(period, user.id);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user?.id, period]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  if (!authLoading && !user) {
    return null;
  }

  const showChartsBusy = loading || authLoading;
  const summary = data?.summaryTop;
  const sdgSub =
    data != null
      ? `依本人打卡列對 SDG 標籤計次（${pl}，${data.chartStart}～${data.chartEnd}）；長條寬度為佔總次數之比例（%）`
      : "";

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
          圖表載入失敗：{error}
          <span className="mt-1 block text-xs text-[var(--color-subtle)]">
            若為 SDG 分布，請確認已套用
            `20260321220000_leaderboard_analytics_rpc.sql`。
          </span>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summary && !showChartsBusy ? (
          <>
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                累計得分
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summary.totalScore.toLocaleString("zh-Hant-TW")}
              </p>
            </div>
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                打卡天數
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summary.checkInDays.toLocaleString("zh-Hant-TW")}天
              </p>
            </div>
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                最長 streak
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summary.longestStreak > 0
                  ? `${summary.longestStreak} 天`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                SDG 覆蓋項
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summary.sdgDistinctCount.toLocaleString("zh-Hant-TW")}項
              </p>
              <p className="mt-1 text-[10px] text-[var(--color-subtle)]">
                期間內曾出現之相異 SDG 數
              </p>
            </div>
            <div className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-bg)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                單日最高 SDG 覆蓋數
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                {summary.maxSingleDaySdgCoverage.toLocaleString("zh-Hant-TW")}項
              </p>
              <p className="mt-1 text-[10px] text-[var(--color-subtle)]">
                單日曾觸及之相異 SDG 數之峰值（來自每日統計）
              </p>
            </div>
          </>
        ) : (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </>
        )}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-white)] p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            {data
              ? profileScoreTitle(data.dailyChartMode, pl)
              : `分數表（個人·${pl}）`}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
            {data ? profileScoreSubtitle(data.dailyChartMode) : "載入中…"}
          </p>
          <div className="mt-6 w-full min-w-0 overflow-x-auto overflow-y-visible pb-2 pt-2 [-webkit-overflow-scrolling:touch] touch-pan-x">
            <div className="flex min-h-[200px] w-full min-w-0 flex-col justify-end">
              {data ? (
                <GlobalDailyCompletionBars points={data.dailyScores} />
              ) : (
                <Skeleton className="h-52 w-full rounded-xl" />
              )}
            </div>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-white)] p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            SDG 行動分布
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
            {data ? sdgSub : "載入中…"}
          </p>
          <div className="mt-4 max-h-64 overflow-y-auto pr-1">
            {data ? (
              <SdgDistributionBars rows={data.sdgDistribution} />
            ) : (
              <Skeleton className="h-48 w-full rounded-xl" />
            )}
          </div>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ProfileRecordsSection />
        </div>
      </div>
    </div>
  );
}
