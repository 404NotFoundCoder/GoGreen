"use client";

import { LeaderboardPeriodBar } from "@/components/leaderboard/LeaderboardPeriodBar";
import { ProfileChartsSection } from "@/components/profile/ProfileChartsSection";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import { useState } from "react";

export function ProfileAnalyticsShell() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          我的數據
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
          選「至今」時，上方五卡與分數表／SDG 為今年 1/1
          起算至今日。下方「各項完成率／每週紀錄」之區間與此處分開設定。
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

      <ProfileChartsSection period={period} />
    </section>
  );
}
