"use client";

import { LeaderboardPeriodBar } from "@/components/leaderboard/LeaderboardPeriodBar";
import { ProfileChartsSection } from "@/components/profile/ProfileChartsSection";
import { ProfileDailyStats } from "@/components/profile/ProfileDailyStats";
import { ProfileLeaderboardSummary } from "@/components/profile/ProfileLeaderboardSummary";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { useState } from "react";

export function ProfileAnalyticsShell() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          我的數據與排行
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
          本週／本月與排行榜期間一致；選「至今」時，下方圖表（密度、完成項次、SDG）為今年
          1/1 起算至今日；「我的排行摘要」仍依全體榜「至今」之累計區間。
        </p>
      </div>

      <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4">
        <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
          時間範圍
        </p>
        <div className="mt-2">
          <LeaderboardPeriodBar period={period} onChange={setPeriod} />
        </div>
      </div>

      <ProfileLeaderboardSummary period={period} />
      <ProfileChartsSection period={period} />
      <ProfileDailyStats period={period} />
    </section>
  );
}
