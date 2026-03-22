"use client";

import {
  LeaderboardPeriodBar,
  periodScopeLabel,
} from "@/components/leaderboard/LeaderboardPeriodBar";
import { RankMark } from "@/components/leaderboard/RankMark";
import {
  GlobalDailyCompletionBars,
  GroupMemberCountBars,
  GroupsAvgScoreBars,
  GroupsSdgBars,
  HotActionsList,
  SdgDistributionBars,
} from "@/components/leaderboard/LeaderboardViz";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGlobalLeaderboard } from "@/hooks/useGlobalLeaderboard";
import { useGlobalLeaderboardCharts } from "@/hooks/useGlobalLeaderboardCharts";
import { useGroupLeaderboardCharts } from "@/hooks/useGroupLeaderboardCharts";
import { useGroupMemberLeaderboard } from "@/hooks/useGroupMemberLeaderboard";
import { useGroupPeriodStats } from "@/hooks/useGroupPeriodStats";
import { useGroupsLeaderboard } from "@/hooks/useGroupsLeaderboard";
import { usePersonalLeaderboard } from "@/hooks/usePersonalLeaderboard";
import { useGroups } from "@/hooks/useGroups";
import type { PersonalLeaderboardSnapshot } from "@/lib/supabase/leaderboard";
import type { GlobalLeaderboardChartsData } from "@/lib/supabase/leaderboardAnalytics";
import { SDG_COLORS } from "@/constants/sdg";
import {
  formatGroupScoreSubline,
  formatGroupSdgSubline,
  formatGroupTierBonusSubline,
  formatScoreSubline,
  formatStreakTierBonusSubline,
  sdgRankSum,
  type GroupRankedRow,
  type LeaderboardDimension,
  type LeaderboardPeriod,
  type RankedRow,
} from "@/lib/utils/leaderboard";
import { ChevronLeft, ChevronRight, Flame, LayoutGrid, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const USER_DIMS: { id: LeaderboardDimension; label: string }[] = [
  { id: "weighted", label: "總加權" },
  { id: "score", label: "分數" },
  { id: "count", label: "Streak Tier 加成" },
  { id: "sdg", label: "SDG 覆蓋" },
];

const GROUP_DIMS: { id: LeaderboardDimension; label: string }[] = [
  { id: "weighted", label: "總加權" },
  { id: "score", label: "平均分數" },
  { id: "count", label: "平均 Streak Tier 加成" },
  { id: "sdg", label: "SDG 覆蓋" },
];

const SCOPES = [
  { id: "global" as const, label: "全體", icon: Trophy },
  { id: "group" as const, label: "群組內", icon: Users },
  { id: "groups" as const, label: "各群間", icon: LayoutGrid },
  { id: "personal" as const, label: "個人", icon: Flame },
];

/** Streak Tier 與 DB `streak_tier_bonus`／`constants/scoring.ts` 一致 */
const STREAK_TIER_RULES_LINE =
  "Tier：連續 1–6 天 +5、7–13 天 +15、14–29 天 +30、≥30 天 +50（無連續則 0）。每日依「當日」連續天數對應上表後加總。";

const STREAK_TIER_EXAMPLES =
  "範例：① 連續第 3 天仍有打卡，當日 streak=3（屬 1–6 天），該日只計 +5。② 連續滿 7 天那天 streak=7（屬 7–13 天），該日起當日計 +15。③「5×3日」表示有 3 天都落在 +5 這一級，貢獻 5+5+5。④「加成加總 5＝5×1日」表示只有 1 天列入，且該日為 +5。";

/** 全體／群組內：依目前子 Tab 說明「怎麼算」，含 N 人時線性積分範例 */
function leaderboardUserDimensionHint(dimension: LeaderboardDimension): string {
  if (dimension === "weighted") {
    return [
      "總加權：在「分數、Streak Tier 加成、SDG 覆蓋」三個維度各排一次名次。",
      "每個維度裡，若有 N 人參與，第 1 名得 N 分、第 2 名得 N−1 分……最後一名得 1 分；三個維度的分數加總。",
      "例如共 3 人時，單一維度第 1 名是 3 分；若三個維度都是第 1 名，總加權最高為 3+3+3=9 分。",
    ].join("");
  }
  if (dimension === "score") {
    return "分數：所選期間內每日完成項之 points 加總（公版／自訂依各項 points），加總愈高名次愈前；不含 Streak Tier 加成。目前預設每完成一項 10 分，可看成 (公版次數 + 自訂次數) × 10。";
  }
  if (dimension === "count") {
    return `「Streak Tier 加成」：${STREAK_TIER_RULES_LINE}加總愈高名次愈前。${STREAK_TIER_EXAMPLES}`;
  }
  return "SDG 覆蓋：名次依 N+M（N＝所選範圍內相異 SDG 數；M＝該範圍內單日涵蓋數之最大）。本週／本月／至今各對應其日期區間。下列顯示標籤，並標註 N、M 與合計。";
}

/** 各群組之間：同構線性積分，對象改為「群組」 */
function leaderboardGroupsDimensionHint(dimension: LeaderboardDimension): string {
  if (dimension === "weighted") {
    return [
      "總加權：在「平均分數、平均 Streak Tier 加成、SDG 覆蓋」三個維度各排一次群組名次。",
      "每個維度裡，若有 M 個群組，第 1 名得 M 分、第 2 名得 M−1 分……最後一名得 1 分；三個維度加總。",
      "例如共 3 群時，單一維度第 1 名是 3 分；三維皆第 1 最高為 3+3+3=9 分。",
    ].join("");
  }
  if (dimension === "score") {
    return "平均分數：各成員期間分數加總後，在群內對人數取平均，數高者居前。";
  }
  if (dimension === "count") {
    return `平均 Streak Tier 加成：各成員期間「加成加總」在群內取平均，愈高居前。${STREAK_TIER_RULES_LINE}${STREAK_TIER_EXAMPLES}`;
  }
  return "SDG 覆蓋：各成員先依所選期間計個人 N+M（相異 SDG 數 + 單日最多），再在群內對人數取平均，平均愈高名次愈前。";
}

function userRowSubline(
  dimension: LeaderboardDimension,
  row: RankedRow,
): string {
  if (dimension === "weighted" && row.weightedBreakdown) {
    const b = row.weightedBreakdown;
    return `總加權＝${b.scorePts}(分數)+${b.countPts}(Streak Tier)+${b.sdgPts}(SDG 覆蓋)`;
  }
  if (dimension === "score") {
    return formatScoreSubline(row);
  }
  if (dimension === "count") {
    return formatStreakTierBonusSubline(
      row.streakTierBonusParts,
      row.totalTierBonusSum,
    );
  }
  if (dimension === "sdg") {
    return "";
  }
  return leaderboardUserDimensionHint(dimension);
}

function groupRowSubline(
  dimension: LeaderboardDimension,
  row: GroupRankedRow,
): string {
  if (dimension === "weighted" && row.weightedBreakdown) {
    const b = row.weightedBreakdown;
    return `總加權＝${b.scorePts}(分數)+${b.countPts}(Streak Tier)+${b.sdgPts}(SDG 覆蓋)`;
  }
  if (dimension === "score") {
    return formatGroupScoreSubline(row);
  }
  if (dimension === "count") {
    return formatGroupTierBonusSubline(row);
  }
  if (dimension === "sdg") {
    return formatGroupSdgSubline(row);
  }
  return leaderboardGroupsDimensionHint(dimension);
}

function LeaderboardSdgTags({
  ids,
  maxLabel,
}: {
  ids: number[];
  maxLabel: number;
}) {
  if (ids.length === 0) {
    return (
      <span className="text-xs text-[var(--color-subtle)]">尚無標籤紀錄</span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ids.map((id) => {
        const c = SDG_COLORS[id];
        if (!c) return null;
        return (
          <span
            key={id}
            className="inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ backgroundColor: c.bg, color: c.text }}
            title={c.label}
          >
            SDG {id}
          </span>
        );
      })}
      <span className="text-[10px] leading-snug text-[var(--color-subtle)]">
        N={ids.length}（相異）+ M={maxLabel}（單日最多）＝{ids.length + maxLabel}{" "}
        （排名用）
      </span>
    </div>
  );
}

function LeaderboardUserRowSubline({
  dimension,
  row,
}: {
  dimension: LeaderboardDimension;
  row: RankedRow;
}) {
  if (dimension === "sdg") {
    return (
      <div className="mt-0.5">
        <LeaderboardSdgTags
          ids={row.coveredSdgIds}
          maxLabel={row.maxSdgCoverage}
        />
      </div>
    );
  }
  return (
    <p className="mt-0.5 text-xs leading-relaxed break-words text-[var(--color-ink-secondary)]">
      {userRowSubline(dimension, row)}
    </p>
  );
}

function dailyCompletionTitle(
  mode: GlobalLeaderboardChartsData["dailyChartMode"] | undefined,
  scopeLabel: string,
): string {
  if (mode === "week_daily")
    return `完成項次（${scopeLabel}·本週每日）`;
  if (mode === "month_four_segments")
    return `完成項次（${scopeLabel}·本月四週）`;
  if (mode === "all_daily")
    return `完成項次（${scopeLabel}·至今·每日）`;
  if (mode === "all_four_segments")
    return `完成項次（${scopeLabel}·至今·四週）`;
  if (mode === "all_monthly")
    return `完成項次（${scopeLabel}·至今·按月）`;
  if (mode === "all_yearly")
    return `完成項次（${scopeLabel}·至今·按年）`;
  return `完成項次（${scopeLabel}）`;
}

function dailyCompletionSubtitle(
  mode: GlobalLeaderboardChartsData["dailyChartMode"] | undefined,
): string {
  if (mode === "week_daily")
    return "本週一至今日每日加總；無完成為 0。切換本週／本月／至今會重算。";
  if (mode === "month_four_segments")
    return "將本月 1 日至今日均分為四週，加總各週完成數（非自然週）。";
  if (mode === "all_daily")
    return "至今未滿一週：補齊該曆週 7 日逐日顯示；滿一週至 7 日內亦逐日；0 為淺灰底。";
  if (mode === "all_four_segments")
    return "至今區間 8～31 天：依日數均分四週加總。";
  if (mode === "all_monthly")
    return "至今區間 32 天～一年：依曆月加總。";
  if (mode === "all_yearly")
    return "至今超過一年：依曆年加總。";
  return "";
}

function maxUserMetricOnPage(
  rows: RankedRow[],
  dimension: LeaderboardDimension,
): number {
  if (rows.length === 0) return 1;
  let m = 0;
  for (const row of rows) {
    let v = 0;
    if (dimension === "weighted") v = row.weightedPoints ?? 0;
    else if (dimension === "score") v = row.totalRawScore;
    else if (dimension === "count") v = row.totalTierBonusSum;
    else v = sdgRankSum(row);
    if (v > m) m = v;
  }
  return m > 0 ? m : 1;
}

function maxGroupMetricOnPage(
  rows: GroupRankedRow[],
  dimension: LeaderboardDimension,
): number {
  if (rows.length === 0) return 1;
  let m = 0;
  for (const row of rows) {
    let v = 0;
    if (dimension === "weighted") v = row.weightedPoints ?? 0;
    else if (dimension === "score") v = row.avgRawScorePerMember;
    else if (dimension === "count") v = row.avgTierBonusPerMember;
    else v = row.avgSdgRankPerMember;
    if (v > m) m = v;
  }
  return m > 0 ? m : 1;
}

function LeaderboardPaginationBar({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  return (
    <nav
      className="mt-4 flex flex-col items-stretch gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="排行榜分頁"
    >
      <p className="text-center text-sm text-[var(--color-ink-secondary)] sm:text-left">
        第 {from}–{to} 筆，共 {totalCount} 筆
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 text-sm font-medium text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="上一頁"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          上一頁
        </button>
        <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-[var(--color-ink-secondary)]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 text-sm font-medium text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="下一頁"
        >
          下一頁
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

function formatUserMetric(
  d: LeaderboardDimension,
  row: {
    totalRawScore: number;
    totalCompleted: number;
    totalTierBonusSum: number;
    sdgUnionCount: number;
    maxSdgCoverage: number;
    weightedPoints?: number;
  },
) {
  if (d === "weighted") return `${row.weightedPoints ?? 0} 分`;
  if (d === "score") return `${Math.round(row.totalRawScore)} 分`;
  if (d === "count") return `${row.totalTierBonusSum} 加成`;
  return `${sdgRankSum(row)}（${row.sdgUnionCount}+${row.maxSdgCoverage}）`;
}

function formatGroupMetric(d: LeaderboardDimension, row: GroupRankedRow) {
  if (d === "weighted") return `${row.weightedPoints ?? 0} 分`;
  if (d === "score") return `${row.avgRawScorePerMember.toFixed(1)} 分`;
  if (d === "count") return `${row.avgTierBonusPerMember.toFixed(1)} 加成/人`;
  return `${row.avgSdgRankPerMember.toFixed(1)} 均`;
}

function DimensionTabs({
  dimension,
  onChange,
  variant,
}: {
  dimension: LeaderboardDimension;
  onChange: (d: LeaderboardDimension) => void;
  variant: "user" | "group";
}) {
  const dims = variant === "user" ? USER_DIMS : GROUP_DIMS;
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
    >
      {dims.map((d) => (
        <button
          key={d.id}
          type="button"
          role="tab"
          aria-selected={dimension === d.id}
          onClick={() => onChange(d.id)}
          className={[
            "min-h-[40px] shrink-0 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition",
            dimension === d.id
              ? "bg-[var(--color-primary-strong)] text-[var(--color-white)] shadow-sm"
              : "border-[0.5px] border-transparent bg-[var(--color-white)]/60 text-[var(--color-ink-secondary)] hover:border-[var(--color-muted)]",
          ].join(" ")}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

function UserRowBar({
  row,
  dimension,
  maxVal,
}: {
  row: RankedRow;
  dimension: LeaderboardDimension;
  maxVal: number;
}) {
  const raw =
    dimension === "weighted"
      ? row.weightedPoints ?? 0
      : dimension === "score"
        ? row.totalRawScore
        : dimension === "count"
          ? row.totalTierBonusSum
          : sdgRankSum(row);
  const pct = maxVal > 0 ? Math.min(100, Math.round((raw / maxVal) * 100)) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[min(100%,14rem)]">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs tabular-nums text-[var(--color-ink-secondary)]">
          {formatUserMetric(dimension, row)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-white)]/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary-strong)] to-[var(--color-primary)] transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GroupRowBar({
  row,
  dimension,
  maxVal,
}: {
  row: GroupRankedRow;
  dimension: LeaderboardDimension;
  maxVal: number;
}) {
  const raw =
    dimension === "weighted"
      ? row.weightedPoints ?? 0
      : dimension === "score"
        ? row.avgRawScorePerMember
        : dimension === "count"
          ? row.avgTierBonusPerMember
          : row.avgSdgRankPerMember;
  const pct = maxVal > 0 ? Math.min(100, Math.round((raw / maxVal) * 100)) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[min(100%,14rem)]">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs tabular-nums text-[var(--color-ink-secondary)]">
          {formatGroupMetric(dimension, row)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-white)]/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary-dark)] to-[var(--color-primary-strong)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function avatarLetter(name: string) {
  const t = name.trim();
  return t ? t.slice(0, 1) : "?";
}

function PersonalLeaderboardBody({
  p,
  period,
}: {
  p: PersonalLeaderboardSnapshot;
  period: LeaderboardPeriod;
}) {
  const pl = periodScopeLabel(period);
  return (
    <>
      <div className="-mx-1 min-w-0 w-full overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch] lg:mx-0">
        <div className="flex w-max min-w-full gap-4 lg:grid lg:w-full lg:min-w-0 lg:grid-cols-3 lg:gap-4">
        <div className="w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-gradient-to-br from-[var(--color-primary-light)]/70 to-[var(--color-surface)] p-5 shadow-sm lg:w-full lg:min-w-0 lg:max-w-none">
          <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
            我的全體排名（總加權）
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--color-primary-dark)]">
            {p.globalRanks.weighted != null
              ? `第 ${p.globalRanks.weighted} 名`
              : "未上榜"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-subtle)]">
            共 {p.totalParticipants} 人曾於「{pl}」區間內打卡
          </p>
        </div>
        <div className="w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-5 shadow-sm lg:w-full lg:min-w-0 lg:max-w-none">
          <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
            群組內排名（總加權）
          </p>
          {p.group ? (
            <>
              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                {p.group.name}
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {p.groupRanks?.weighted != null
                  ? `第 ${p.groupRanks.weighted} 名`
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
          {p.group && p.groupsRanks ? (
            <>
              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">
                {p.group.name}
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {p.groupsRanks.weighted != null
                  ? `第 ${p.groupsRanks.weighted} 名`
                  : "未上榜"}
              </p>
              {p.totalGroups > 0 ? (
                <p className="mt-1 text-xs text-[var(--color-subtle)]">
                  共 {p.totalGroups} 個群組
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

      <div className="overflow-hidden rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)]/80 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)]/80 text-[var(--color-ink-secondary)]">
              <th className="px-4 py-3 font-medium">維度</th>
              <th className="px-4 py-3 font-medium">全體</th>
              <th className="px-4 py-3 font-medium">群組內排名</th>
              <th className="px-4 py-3 font-medium">各群間</th>
            </tr>
          </thead>
          <tbody>
            {USER_DIMS.map((d) => (
              <tr
                key={d.id}
                className="border-b-[0.5px] border-[var(--color-muted)]/50 last:border-0"
              >
                <td className="px-4 py-3 text-[var(--color-ink)]">{d.label}</td>
                <td className="px-4 py-3 tabular-nums text-[var(--color-ink-secondary)]">
                  {p.globalRanks[d.id] != null
                    ? `第 ${p.globalRanks[d.id]} 名`
                    : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--color-ink-secondary)]">
                  {!p.groupRanks
                    ? "—"
                    : p.groupRanks[d.id] != null
                      ? `第 ${p.groupRanks[d.id]} 名`
                      : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--color-ink-secondary)]">
                  {!p.groupsRanks
                    ? "—"
                    : p.groupsRanks[d.id] != null
                      ? `第 ${p.groupsRanks[d.id]} 名`
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function LeaderboardShell() {
  const [scope, setScope] = useState<
    "global" | "group" | "groups" | "personal"
  >("global");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [dimension, setDimension] =
    useState<LeaderboardDimension>("weighted");
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    setListPage(1);
  }, [scope, period, dimension]);

  const { mine } = useGroups();
  const myGroupId = useMemo(() => {
    if (!mine.length) return null;
    return mine[0]!.group_id as string;
  }, [mine]);

  const myGroupName = useMemo(() => {
    const raw = mine[0]?.groups as unknown;
    const g = (Array.isArray(raw) ? raw[0] : raw) as { name?: string } | null;
    return g?.name ?? "我的群組";
  }, [mine]);

  const globalLb = useGlobalLeaderboard(period, dimension, listPage);
  const groupLb = useGroupMemberLeaderboard(
    scope === "group" ? myGroupId : null,
    period,
    dimension,
    listPage,
  );
  const groupsLb = useGroupsLeaderboard(period, dimension, listPage);
  const personalLb = usePersonalLeaderboard(period);

  const globalCharts = useGlobalLeaderboardCharts(period, scope === "global");
  const groupCharts = useGroupLeaderboardCharts(
    period,
    scope === "group" && Boolean(myGroupId),
    myGroupId,
  );
  const groupPeriodStats = useGroupPeriodStats(
    myGroupId,
    period,
    scope === "group" && Boolean(myGroupId),
  );

  const globalMax = useMemo(
    () => maxUserMetricOnPage(globalLb.data?.rows ?? [], dimension),
    [globalLb.data?.rows, dimension],
  );

  const groupMax = useMemo(
    () => maxUserMetricOnPage(groupLb.data?.rows ?? [], dimension),
    [groupLb.data?.rows, dimension],
  );

  const groupsMax = useMemo(
    () => maxGroupMetricOnPage(groupsLb.data?.rows ?? [], dimension),
    [groupsLb.data?.rows, dimension],
  );

  return (
    <div className="min-w-0 space-y-8">
      {/* 主視角：手機橫向滑動，避免換行跑版 */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SCOPES.map((s) => {
          const Icon = s.icon;
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={[
                "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-[var(--color-primary-strong)] text-[var(--color-white)] shadow-md"
                  : "border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-primary-light)]/50",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 opacity-90" aria-hidden />
              {s.label}
            </button>
          );
        })}
      </div>

      {scope !== "personal" ? (
        <div className="space-y-4 rounded-3xl border-[0.5px] border-[var(--color-muted)]/90 bg-gradient-to-b from-[var(--color-white)]/90 to-[var(--color-surface)] p-4 shadow-[0_8px_30px_rgba(45,52,40,0.06)] sm:p-5">
          <div className="min-w-0 space-y-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-[var(--color-ink-secondary)] uppercase">
                時間範圍
              </p>
              <div className="mt-2 w-full min-w-0">
                <LeaderboardPeriodBar period={period} onChange={setPeriod} />
              </div>
            </div>
            <div className="min-w-0 border-t border-[var(--color-muted)]/50 pt-3">
              <p className="text-xs font-medium tracking-wide text-[var(--color-ink-secondary)] uppercase">
                排序依據
              </p>
              <p className="mt-1 text-xs leading-relaxed break-words text-[var(--color-subtle)]">
                {scope === "groups"
                  ? leaderboardGroupsDimensionHint(dimension)
                  : leaderboardUserDimensionHint(dimension)}
              </p>
            </div>
          </div>
          <DimensionTabs
            dimension={dimension}
            onChange={setDimension}
            variant={scope === "groups" ? "group" : "user"}
          />
        </div>
      ) : (
        <div className="rounded-3xl border-[0.5px] border-[var(--color-muted)]/90 bg-gradient-to-b from-[var(--color-white)]/90 to-[var(--color-surface)] p-4 shadow-[0_8px_30px_rgba(45,52,40,0.06)] sm:p-5">
          <p className="text-xs font-medium tracking-wide text-[var(--color-ink-secondary)] uppercase">
            時間範圍
          </p>
          <div className="mt-2">
            <LeaderboardPeriodBar period={period} onChange={setPeriod} />
          </div>
        </div>
      )}

      {/* 全體 */}
      {scope === "global" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-primary-light)]/40 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                「{periodScopeLabel(period)}」參與人數
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {globalLb.loading ? "—" : globalLb.data?.totalParticipants ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                曾於「{periodScopeLabel(period)}」區間內有打卡紀錄的使用者
              </p>
            </div>
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                「{periodScopeLabel(period)}」完成項次加總
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {globalCharts.loading
                  ? "—"
                  : globalCharts.data?.totalCompletions ?? "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                「{periodScopeLabel(period)}」區間內所有打卡完成數加總
              </p>
            </div>
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                「{periodScopeLabel(period)}」曾達 9+ SDG 覆蓋人數
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {globalCharts.loading
                  ? "—"
                  : (globalCharts.data?.usersWithFullSdgCoverage ?? "—")}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                「{periodScopeLabel(period)}」內單日覆蓋數曾 ≥9 的使用者
              </p>
            </div>
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                「{periodScopeLabel(period)}」熱門行動（第 1 名）
              </p>
              <p className="mt-1 line-clamp-2 text-lg font-semibold text-[var(--color-ink)]">
                {globalCharts.loading
                  ? "—"
                  : globalCharts.data?.hotActions[0]?.label ?? "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                {globalCharts.data?.hotActions[0]
                  ? `${globalCharts.data.hotActions[0].count} 次完成`
                  : "依打卡次數"}
              </p>
            </div>
          </div>

          {globalCharts.error ? (
            <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
              圖表資料載入失敗：{globalCharts.error.message}（請確認已套用 migration
              `20260321220000_leaderboard_analytics_rpc.sql` 等）
            </p>
          ) : null}

          {!globalCharts.loading && globalCharts.data ? (
            <div
              key={`global-charts-${period}`}
              className="grid gap-4 lg:grid-cols-2"
            >
              <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  {dailyCompletionTitle(
                    globalCharts.data.dailyChartMode,
                    "全體",
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
                  {dailyCompletionSubtitle(globalCharts.data.dailyChartMode)}
                </p>
                <div className="mt-6 flex min-h-[200px] flex-col justify-end overflow-x-auto overflow-y-visible pb-2 pt-2">
                  <GlobalDailyCompletionBars
                    points={globalCharts.data.dailyCompletions}
                  />
                </div>
              </div>
              <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  SDG 行動分布
                </h3>
                <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
                  依打卡列對 SDG 標籤計次；長條寬度為佔總次數之比例（%）
                </p>
                <div className="mt-4 max-h-64 overflow-y-auto pr-1">
                  <SdgDistributionBars
                    rows={globalCharts.data.sdgDistribution}
                  />
                </div>
              </div>
              <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm lg:col-span-2">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  熱門行動 Top 5
                </h3>
                <div className="mt-3">
                  <HotActionsList items={globalCharts.data.hotActions} />
                </div>
              </div>
            </div>
          ) : globalCharts.loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56 rounded-2xl" />
              <Skeleton className="h-56 rounded-2xl" />
            </div>
          ) : null}

          {globalLb.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : null}
          {globalLb.error ? (
            <p className="text-[var(--color-ink)]">{globalLb.error.message}</p>
          ) : null}
          {!globalLb.loading &&
          globalLb.data &&
          globalLb.data.rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-ink-secondary)]">
              還沒有人上榜，成為第一個完成行動的人吧！
            </p>
          ) : null}
          {!globalLb.loading && globalLb.data && globalLb.data.rows.length > 0 ? (
            <ol className="space-y-3">
              {globalLb.data.rows.map((row) => (
                <li
                  key={row.userId}
                  className="flex flex-col gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RankMark rank={row.rank} />
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-base font-semibold text-[var(--color-primary-dark)]">
                      {avatarLetter(row.nickname)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-ink)]">
                        {row.nickname}
                      </p>
                      <LeaderboardUserRowSubline
                        dimension={dimension}
                        row={row}
                      />
                    </div>
                  </div>
                  <UserRowBar
                    row={row}
                    dimension={dimension}
                    maxVal={globalMax}
                  />
                </li>
              ))}
            </ol>
          ) : null}
          {!globalLb.loading && globalLb.data && globalLb.data.rows.length > 0 ? (
            <LeaderboardPaginationBar
              page={globalLb.data.page}
              totalPages={globalLb.data.totalPages}
              totalCount={globalLb.data.totalParticipants}
              pageSize={globalLb.data.pageSize}
              onPageChange={setListPage}
            />
          ) : null}
        </section>
      ) : null}

      {/* 群組內 */}
      {scope === "group" ? (
        <section className="space-y-4">
          {!myGroupId ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] p-8 text-center">
              <p className="font-medium text-[var(--color-ink)]">
                尚未加入群組
              </p>
              <p className="mt-2 text-sm text-[var(--color-ink-secondary)]">
                加入群組後即可查看群組內排名。
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-gradient-to-br from-[var(--color-primary-light)]/50 to-[var(--color-surface)] p-4">
                <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                  目前群組
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
                  {myGroupName}
                </p>
              </div>
              {groupPeriodStats.loading ? (
                <Skeleton className="h-32 w-full rounded-2xl" />
              ) : null}
              {groupPeriodStats.error ? (
                <p className="text-sm text-[var(--color-ink)]">
                  {groupPeriodStats.error.message}
                </p>
              ) : null}
              {groupPeriodStats.data ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
                    <p className="text-xs text-[var(--color-ink-secondary)]">
                      群組總原始分
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                      {groupPeriodStats.data.totalRawScore}
                    </p>
                  </div>
                  <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
                    <p className="text-xs text-[var(--color-ink-secondary)]">
                      群組平均 SDG 指標（N+M）
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                      {groupPeriodStats.data.avgSdgRankPerMember.toFixed(1)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-subtle)]">
                      各成員期間 N+M 之和÷人數（與「各群間」榜一致）
                    </p>
                  </div>
                  <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
                    <p className="text-xs text-[var(--color-ink-secondary)]">
                      期間最長 streak
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                      {groupPeriodStats.data.longestStreakInPeriod} 天
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-subtle)]">
                      {groupPeriodStats.data.longestStreakMember
                        ? `由 ${groupPeriodStats.data.longestStreakMember.nickname} 保持`
                        : "尚無有效 streak"}
                    </p>
                  </div>
                  <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
                    <p className="text-xs text-[var(--color-ink-secondary)]">
                      最活躍成員
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
                      {groupPeriodStats.data.topMember?.nickname ?? "—"}
                    </p>
                    <p className="text-xs text-[var(--color-subtle)]">
                      {groupPeriodStats.data.topMember
                        ? `${groupPeriodStats.data.topMember.totalCompleted} 項完成`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : null}

              {groupCharts.error ? (
                <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
                  群組圖表載入失敗：{groupCharts.error.message}（請確認已套用
                  `20260321230100_group_sdg_distribution_rpc.sql`）
                </p>
              ) : null}

              {!groupCharts.loading && groupCharts.data ? (
                <div
                  key={`group-charts-${period}`}
                  className="grid gap-4 lg:grid-cols-2"
                >
                  <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                      {dailyCompletionTitle(
                        groupCharts.data.dailyChartMode,
                        "本群",
                      )}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
                      {dailyCompletionSubtitle(groupCharts.data.dailyChartMode)}
                    </p>
                    <div className="mt-6 flex min-h-[200px] flex-col justify-end overflow-x-auto overflow-y-visible pb-2 pt-2">
                      <GlobalDailyCompletionBars
                        points={groupCharts.data.dailyCompletions}
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                      SDG 行動分布（本群）
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
                      本群成員打卡之 SDG 計次；長條為佔總次數比例（%），配色同 SDG
                      標籤
                    </p>
                    <div className="mt-4 max-h-64 overflow-y-auto pr-1">
                      <SdgDistributionBars
                        rows={groupCharts.data.sdgDistribution}
                      />
                    </div>
                  </div>
                </div>
              ) : groupCharts.loading ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Skeleton className="h-56 rounded-2xl" />
                  <Skeleton className="h-56 rounded-2xl" />
                </div>
              ) : null}

              {!groupLb.loading &&
              groupLb.data &&
              (groupLb.data.memberBarRows?.length ?? 0) > 0 ? (
                <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                    各成員完成項數（前 12）
                  </h3>
                  <div className="mt-3">
                    <GroupMemberCountBars
                      rows={groupLb.data.memberBarRows ?? []}
                    />
                  </div>
                </div>
              ) : null}

              {groupLb.error ? (
                <p className="text-[var(--color-ink)]">
                  {groupLb.error.message}
                </p>
              ) : null}
              {!groupLb.loading &&
              groupLb.data &&
              groupLb.data.rows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-ink-secondary)]">
                  此群組尚無成員，或無法載入成員列表。
                </p>
              ) : null}
              {!groupLb.loading &&
              groupLb.data &&
              groupLb.data.rows.length > 0 ? (
                <>
                  <p className="text-sm text-[var(--color-ink-secondary)]">
                    「{periodScopeLabel(period)}」群組成員共{" "}
                    {groupLb.data.totalParticipants}{" "}
                    人（含該區間內尚未打卡者，仍以 0 分列入排行）
                  </p>
                  <ol className="space-y-3">
                    {groupLb.data.rows.map((row) => (
                      <li
                        key={row.userId}
                        className="flex flex-col gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <RankMark rank={row.rank} />
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-base font-semibold text-[var(--color-primary-dark)]">
                            {avatarLetter(row.nickname)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--color-ink)]">
                              {row.nickname}
                            </p>
                            <LeaderboardUserRowSubline
                              dimension={dimension}
                              row={row}
                            />
                          </div>
                        </div>
                        <UserRowBar
                          row={row}
                          dimension={dimension}
                          maxVal={groupMax}
                        />
                      </li>
                    ))}
                  </ol>
                  <LeaderboardPaginationBar
                    page={groupLb.data.page}
                    totalPages={groupLb.data.totalPages}
                    totalCount={groupLb.data.totalParticipants}
                    pageSize={groupLb.data.pageSize}
                    onPageChange={setListPage}
                  />
                </>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* 各群間 */}
      {scope === "groups" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                參與排行群組數
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {groupsLb.loading ? "—" : groupsLb.data?.totalGroups ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                「{periodScopeLabel(period)}」平均原始分領先
              </p>
              <p className="mt-1 line-clamp-2 text-lg font-semibold text-[var(--color-ink)]">
                {groupsLb.data?.topAvgRaw?.name ?? "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                {groupsLb.data?.topAvgRaw
                  ? `平均 ${groupsLb.data.topAvgRaw.avg.toFixed(1)} 分`
                  : ""}
              </p>
            </div>
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                SDG 覆蓋最高群組
              </p>
              <p className="mt-1 line-clamp-2 text-lg font-semibold text-[var(--color-ink)]">
                {groupsLb.data?.topSdg?.name ?? "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                {groupsLb.data?.topSdg
                  ? `平均指標 ${groupsLb.data.topSdg.avg.toFixed(1)}`
                  : ""}
              </p>
            </div>
          </div>
          {!groupsLb.loading &&
          groupsLb.data &&
          groupsLb.data.totalGroups > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  各群組平均分（前 8）
                </h3>
                <div className="mt-3">
                  <GroupsAvgScoreBars
                    rows={groupsLb.data.chartTopByScore ?? []}
                  />
                </div>
              </div>
              <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  各群組 SDG 覆蓋（前 8）
                </h3>
                <div className="mt-3">
                  <GroupsSdgBars rows={groupsLb.data.chartTopBySdg ?? []} />
                </div>
              </div>
            </div>
          ) : null}
          {groupsLb.loading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : null}
          {groupsLb.error ? (
            <p className="text-[var(--color-ink)]">{groupsLb.error.message}</p>
          ) : null}
          {!groupsLb.loading &&
          groupsLb.data &&
          groupsLb.data.rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-muted)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-ink-secondary)]">
              尚無可排名的群組。
            </p>
          ) : null}
          {!groupsLb.loading &&
          groupsLb.data &&
          groupsLb.data.rows.length > 0 ? (
            <ol className="space-y-3">
              {groupsLb.data.rows.map((row) => (
                <li
                  key={row.groupId}
                  className="flex flex-col gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <RankMark rank={row.rank} />
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-pale)] text-base font-semibold text-[var(--color-primary-dark)]">
                      {avatarLetter(row.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-ink)]">
                        {row.name}
                      </p>
                      <p className="text-xs text-[var(--color-ink-secondary)]">
                        {row.memberCount} 人 ·{" "}
                        {row.isPublic ? (
                          <span className="text-emerald-800">公開</span>
                        ) : (
                          <span>私人</span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-ink-secondary)]">
                        {groupRowSubline(dimension, row)}
                      </p>
                    </div>
                  </div>
                  <GroupRowBar
                    row={row}
                    dimension={dimension}
                    maxVal={groupsMax}
                  />
                </li>
              ))}
            </ol>
          ) : null}
          {!groupsLb.loading &&
          groupsLb.data &&
          groupsLb.data.totalGroups > 0 ? (
            <LeaderboardPaginationBar
              page={groupsLb.data.page}
              totalPages={groupsLb.data.totalPages}
              totalCount={groupsLb.data.totalGroups}
              pageSize={groupsLb.data.pageSize}
              onPageChange={setListPage}
            />
          ) : null}
        </section>
      ) : null}

      {/* 個人 */}
      {scope === "personal" ? (
        <section className="min-w-0 space-y-6">
          {personalLb.loading ? (
            <div className="-mx-1 flex min-w-0 w-full gap-4 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] lg:mx-0 lg:grid lg:min-w-0 lg:grid-cols-3 lg:gap-4">
              <Skeleton className="h-48 min-w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl lg:w-full lg:min-w-0" />
              <Skeleton className="h-48 min-w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl lg:w-full lg:min-w-0" />
              <Skeleton className="h-48 min-w-[min(22rem,calc(100vw-2.5rem))] shrink-0 rounded-2xl lg:w-full lg:min-w-0" />
            </div>
          ) : null}
          {personalLb.error ? (
            <p className="text-[var(--color-ink)]">
              {personalLb.error.message}
            </p>
          ) : null}
          {personalLb.data ? (
            <PersonalLeaderboardBody p={personalLb.data} period={period} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
