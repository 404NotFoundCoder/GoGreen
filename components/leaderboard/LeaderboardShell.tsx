"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useGlobalLeaderboard } from "@/hooks/useGlobalLeaderboard";
import { useGroupMemberLeaderboard } from "@/hooks/useGroupMemberLeaderboard";
import { useGroupsLeaderboard } from "@/hooks/useGroupsLeaderboard";
import { usePersonalLeaderboard } from "@/hooks/usePersonalLeaderboard";
import { useGroups } from "@/hooks/useGroups";
import type { PersonalLeaderboardSnapshot } from "@/lib/supabase/leaderboard";
import type {
  GroupRankedRow,
  LeaderboardDimension,
  LeaderboardPeriod,
  RankedRow,
} from "@/lib/utils/leaderboard";
import { Flame, LayoutGrid, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "week", label: "本週" },
  { id: "month", label: "本月" },
  { id: "all", label: "累計" },
];

const USER_DIMS: { id: LeaderboardDimension; label: string }[] = [
  { id: "weighted", label: "總加權" },
  { id: "score", label: "分數" },
  { id: "count", label: "完成數" },
  { id: "sdg", label: "SDG 覆蓋" },
];

const GROUP_DIMS: { id: LeaderboardDimension; label: string }[] = [
  { id: "weighted", label: "總加權" },
  { id: "score", label: "平均分" },
  { id: "count", label: "平均完成數" },
  { id: "sdg", label: "SDG 覆蓋" },
];

const SCOPES = [
  { id: "global" as const, label: "全體", icon: Trophy },
  { id: "group" as const, label: "群組內", icon: Users },
  { id: "groups" as const, label: "各群間", icon: LayoutGrid },
  { id: "personal" as const, label: "個人", icon: Flame },
];

function RankBadge({ rank }: { rank: number }) {
  const ring =
    rank === 1
      ? "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-950 shadow-sm ring-2 ring-amber-300/70"
      : rank === 2
        ? "bg-gradient-to-br from-slate-200 to-slate-100 text-slate-800 ring-1 ring-slate-300/80"
        : rank === 3
          ? "bg-gradient-to-br from-orange-100 to-orange-50 text-orange-950 ring-1 ring-orange-300/70"
          : "border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] text-[var(--color-ink-secondary)]";
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${ring}`}
    >
      {rank}
    </span>
  );
}

function formatUserMetric(
  d: LeaderboardDimension,
  row: {
    avgNormalized: number;
    totalCompleted: number;
    maxSdgCoverage: number;
    weightedPoints?: number;
  },
) {
  if (d === "weighted") return `${row.weightedPoints ?? 0} 分`;
  if (d === "score") return row.avgNormalized.toFixed(1);
  if (d === "count") return `${row.totalCompleted} 項`;
  return `${row.maxSdgCoverage} 個`;
}

function formatGroupMetric(d: LeaderboardDimension, row: GroupRankedRow) {
  if (d === "weighted") return `${row.weightedPoints ?? 0} 分`;
  if (d === "score") return row.avgNormalized.toFixed(1);
  if (d === "count") return `${row.avgCompletedPerMember.toFixed(1)} 項/人`;
  return `${row.maxSdgCoverage} 個`;
}

function PeriodBar({
  period,
  onChange,
}: {
  period: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={[
            "min-h-[40px] rounded-full px-4 py-2 text-sm font-medium transition",
            period === p.id
              ? "bg-[var(--color-white)] text-[var(--color-ink)] shadow-sm ring-2 ring-[var(--color-primary-strong)]/35"
              : "border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-white)]/70",
          ].join(" ")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
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
        ? row.avgNormalized
        : dimension === "count"
          ? row.totalCompleted
          : row.maxSdgCoverage;
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
        ? row.avgNormalized
        : dimension === "count"
          ? row.avgCompletedPerMember
          : row.maxSdgCoverage;
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

function PersonalLeaderboardBody({ p }: { p: PersonalLeaderboardSnapshot }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-gradient-to-br from-[var(--color-primary-light)]/70 to-[var(--color-surface)] p-5 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
            我的全體排名（總加權）
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-[var(--color-primary-dark)]">
            {p.globalRanks.weighted != null
              ? `第 ${p.globalRanks.weighted} 名`
              : "未上榜"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-subtle)]">
            共 {p.totalParticipants} 人曾於此期間打卡
          </p>
        </div>
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
            群組排名（總加權）
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
      </div>

      <div className="overflow-hidden rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)]/80 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)]/80 text-[var(--color-ink-secondary)]">
              <th className="px-4 py-3 font-medium">維度</th>
              <th className="px-4 py-3 font-medium">全體</th>
              <th className="px-4 py-3 font-medium">群組內</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-ink-secondary)]">
            期間累計原始分
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
            {p.periodRawScoreSum}
          </p>
        </div>
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-ink-secondary)]">
            期間最佳單日 streak
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
            {p.maxStreakInPeriod} 天
          </p>
        </div>
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-ink-secondary)]">平均標準化分</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
            {p.myAgg ? p.myAgg.avgNormalized.toFixed(1) : "—"}
          </p>
        </div>
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-ink-secondary)]">
            完成數 · SDG 覆蓋（期間）
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
            {p.myAgg
              ? `${p.myAgg.totalCompleted} 項 · ${p.myAgg.maxSdgCoverage} 個`
              : "—"}
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--color-subtle)]">
        打卡熱力圖與每日趨勢圖可至「個人資料」查看近況表。
      </p>
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

  const globalLb = useGlobalLeaderboard(period, dimension);
  const groupLb = useGroupMemberLeaderboard(
    scope === "group" ? myGroupId : null,
    period,
    dimension,
  );
  const groupsLb = useGroupsLeaderboard(period, dimension);
  const personalLb = usePersonalLeaderboard(period);

  const globalMax = useMemo(() => {
    const rows = globalLb.data?.rows ?? [];
    if (!rows.length) return 1;
    const first = rows[0]!;
    if (dimension === "weighted") return first.weightedPoints ?? 1;
    if (dimension === "score") return first.avgNormalized || 1;
    if (dimension === "count") return first.totalCompleted || 1;
    return first.maxSdgCoverage || 1;
  }, [globalLb.data?.rows, dimension]);

  const groupMax = useMemo(() => {
    const rows = groupLb.data?.rows ?? [];
    if (!rows.length) return 1;
    const first = rows[0]!;
    if (dimension === "weighted") return first.weightedPoints ?? 1;
    if (dimension === "score") return first.avgNormalized || 1;
    if (dimension === "count") return first.totalCompleted || 1;
    return first.maxSdgCoverage || 1;
  }, [groupLb.data?.rows, dimension]);

  const groupsMax = useMemo(() => {
    const rows = groupsLb.data?.rows ?? [];
    if (!rows.length) return 1;
    const first = rows[0]!;
    if (dimension === "weighted") return first.weightedPoints ?? 1;
    if (dimension === "score") return first.avgNormalized || 1;
    if (dimension === "count") return first.avgCompletedPerMember || 1;
    return first.maxSdgCoverage || 1;
  }, [groupsLb.data?.rows, dimension]);

  return (
    <div className="space-y-8">
      {/* 主視角 */}
      <div className="flex flex-wrap gap-2">
        {SCOPES.map((s) => {
          const Icon = s.icon;
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={[
                "inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-[var(--color-ink-secondary)] uppercase">
                時間範圍
              </p>
              <PeriodBar period={period} onChange={setPeriod} />
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium tracking-wide text-[var(--color-ink-secondary)] uppercase">
                排序依據
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                {scope === "groups"
                  ? "群組間以成員平均表現聚合；「平均分」為平均標準化分。"
                  : "總加權為三維度名次線性積分加總。"}
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
            <PeriodBar period={period} onChange={setPeriod} />
          </div>
        </div>
      )}

      {/* 全體 */}
      {scope === "global" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-primary-light)]/40 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                本期參與人數
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {globalLb.loading ? "—" : globalLb.data?.totalParticipants ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--color-subtle)]">
                曾於此期間留下打卡紀錄的使用者
              </p>
            </div>
            <div className="rounded-2xl border-[0.5px] border-dashed border-[var(--color-muted)] bg-[var(--color-surface)]/80 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                圖表與熱門行動
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-subtle)]">
                SDG 分布與趨勢圖表將於後續版本加入。
              </p>
            </div>
          </div>

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
                    <RankBadge rank={row.rank} />
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-base font-semibold text-[var(--color-primary-dark)]">
                      {avatarLetter(row.nickname)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-ink)]">
                        {row.nickname}
                      </p>
                      <p className="text-xs text-[var(--color-ink-secondary)]">
                        streak 與細節將於展開列提供
                      </p>
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
                <p className="mt-2 text-xs text-[var(--color-subtle)]">
                  群組統計圖表（總分、SDG、成員長條圖）規劃中。
                </p>
              </div>
              {groupLb.loading ? (
                <Skeleton className="h-40 w-full rounded-2xl" />
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
                  此期間群組內尚無打卡紀錄。
                </p>
              ) : null}
              {!groupLb.loading &&
              groupLb.data &&
              groupLb.data.rows.length > 0 ? (
                <>
                  <p className="text-sm text-[var(--color-ink-secondary)]">
                    本期共 {groupLb.data.totalParticipants} 位成員參與排行
                  </p>
                  <ol className="space-y-3">
                    {groupLb.data.rows.map((row) => (
                      <li
                        key={row.userId}
                        className="flex flex-col gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <RankBadge rank={row.rank} />
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-base font-semibold text-[var(--color-primary-dark)]">
                            {avatarLetter(row.nickname)}
                          </div>
                          <p className="min-w-0 truncate font-semibold text-[var(--color-ink)]">
                            {row.nickname}
                          </p>
                        </div>
                        <UserRowBar
                          row={row}
                          dimension={dimension}
                          maxVal={groupMax}
                        />
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* 各群間 */}
      {scope === "groups" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                參與排行群組數
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--color-primary-dark)]">
                {groupsLb.loading ? "—" : groupsLb.data?.totalGroups ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--color-muted)] bg-[var(--color-primary-light)]/30 p-4">
              <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
                群組長條圖
              </p>
              <p className="mt-2 text-sm text-[var(--color-subtle)]">
                各群平均分／SDG 覆蓋比較圖即將推出。
              </p>
            </div>
          </div>
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
                    <RankBadge rank={row.rank} />
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
        </section>
      ) : null}

      {/* 個人 */}
      {scope === "personal" ? (
        <section className="space-y-6">
          {personalLb.loading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : null}
          {personalLb.error ? (
            <p className="text-[var(--color-ink)]">
              {personalLb.error.message}
            </p>
          ) : null}
          {personalLb.data ? (
            <PersonalLeaderboardBody p={personalLb.data} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
