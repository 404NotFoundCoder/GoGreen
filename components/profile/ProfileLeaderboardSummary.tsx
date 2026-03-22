"use client";

import { periodScopeLabel } from "@/components/leaderboard/LeaderboardPeriodBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthContext } from "@/context/AuthContext";
import { usePersonalLeaderboard } from "@/hooks/usePersonalLeaderboard";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";

export function ProfileLeaderboardSummary({
  period,
}: {
  period: LeaderboardPeriod;
}) {
  const { user, loading: authLoading } = useAuthContext();
  const { data, loading, error } = usePersonalLeaderboard(period);
  const pl = periodScopeLabel(period);

  if (!authLoading && !user) {
    return null;
  }

  const showCardSkeleton = authLoading || loading;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--color-ink)]">
          我的排行摘要
        </h3>
        <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
          與排行榜「個人」分頁相同名次；上方時間範圍切換會重算。
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
          {error.message}
        </p>
      ) : null}

      {showCardSkeleton ? (
        <div className="-mx-1 min-w-0 w-full overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch] lg:mx-0">
          <div className="flex w-max min-w-full gap-4 lg:grid lg:w-full lg:min-w-0 lg:grid-cols-3 lg:gap-4">
            <Skeleton className="h-48 w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl lg:w-full lg:min-w-0" />
            <Skeleton className="h-48 w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl lg:w-full lg:min-w-0" />
            <Skeleton className="h-48 w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl lg:w-full lg:min-w-0" />
          </div>
        </div>
      ) : null}

      {!showCardSkeleton && data ? (
        <div className="-mx-1 min-w-0 w-full overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch] lg:mx-0">
          <div className="flex w-max min-w-full gap-4 lg:grid lg:w-full lg:min-w-0 lg:grid-cols-3 lg:gap-4">
            <div className="w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-gradient-to-br from-[var(--color-primary-light)]/70 to-[var(--color-surface)] p-5 shadow-sm lg:w-full lg:min-w-0 lg:max-w-none">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                我的全體排名（總加權）
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {data.globalRanks.weighted != null
                  ? `第 ${data.globalRanks.weighted} 名`
                  : "未上榜"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                共 {data.totalParticipants} 人曾於「{pl}」區間內打卡
              </p>
            </div>
            <div className="w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-5 shadow-sm lg:w-full lg:min-w-0 lg:max-w-none">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                群組內排名（總加權）
              </p>
              {data.group ? (
                <>
                  <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                    {data.group.name}
                  </p>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                    {data.groupRanks?.weighted != null
                      ? `第 ${data.groupRanks.weighted} 名`
                      : "未上榜"}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-ink-secondary)]">
                  尚未加入群組
                </p>
              )}
            </div>
            <div className="w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-5 shadow-sm lg:w-full lg:min-w-0 lg:max-w-none">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                各群間排名（總加權）
              </p>
              {data.group && data.groupsRanks ? (
                <>
                  <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                    {data.group.name}
                  </p>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                    {data.groupsRanks.weighted != null
                      ? `第 ${data.groupsRanks.weighted} 名`
                      : "未上榜"}
                  </p>
                  {data.totalGroups > 0 ? (
                    <p className="mt-1 text-xs text-[var(--color-subtle)]">
                      共 {data.totalGroups} 個群組
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-ink-secondary)]">
                  尚未加入群組
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-[var(--color-subtle)]">
        四維度名次表見「排行榜 → 個人」。
      </p>
    </section>
  );
}
