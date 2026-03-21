import { LEADERBOARD_LIMIT } from "@/constants/config";

export type LeaderboardPeriod = "week" | "month" | "all";
export type LeaderboardDimension = "weighted" | "score" | "count" | "sdg";

export type UserPeriodAgg = {
  userId: string;
  nickname: string;
  /** 期間內平均每日標準化分（無資料日不計入分母時用平均） */
  avgNormalized: number;
  /** 期間內完成項目數加總 */
  totalCompleted: number;
  /** 期間內單日 SDG 覆蓋數之最大值 */
  maxSdgCoverage: number;
};

export type RankedRow = UserPeriodAgg & {
  rank: number;
  weightedPoints?: number;
};

export function linearPoints(rank: number, n: number): number {
  if (n <= 0) return 0;
  return Math.max(0, n - rank + 1);
}

/** 依三維度名次計算總加權（線性積分） */
export function computeWeightedRanks(
  users: UserPeriodAgg[],
): Map<string, number> {
  const n = users.length;
  if (n === 0) return new Map();
  const byScore = [...users].sort((a, b) => b.avgNormalized - a.avgNormalized);
  const byCount = [...users].sort(
    (a, b) => b.totalCompleted - a.totalCompleted,
  );
  const bySdg = [...users].sort(
    (a, b) => b.maxSdgCoverage - a.maxSdgCoverage,
  );

  const out = new Map<string, number>();
  for (const u of users) {
    const rs = byScore.findIndex((x) => x.userId === u.userId) + 1;
    const rc = byCount.findIndex((x) => x.userId === u.userId) + 1;
    const rd = bySdg.findIndex((x) => x.userId === u.userId) + 1;
    out.set(
      u.userId,
      linearPoints(rs, n) + linearPoints(rc, n) + linearPoints(rd, n),
    );
  }
  return out;
}

/** 完整排序並附名次（不截斷），供個人名次與內部計算使用 */
export function rankAllUsers(
  users: UserPeriodAgg[],
  dimension: LeaderboardDimension,
  weighted: Map<string, number>,
): RankedRow[] {
  const sorted = [...users];
  if (dimension === "score") {
    sorted.sort((a, b) => b.avgNormalized - a.avgNormalized);
  } else if (dimension === "count") {
    sorted.sort((a, b) => b.totalCompleted - a.totalCompleted);
  } else if (dimension === "sdg") {
    sorted.sort((a, b) => b.maxSdgCoverage - a.maxSdgCoverage);
  } else {
    sorted.sort(
      (a, b) =>
        (weighted.get(b.userId) ?? 0) - (weighted.get(a.userId) ?? 0),
    );
  }

  return sorted.map((u, i) => ({
    ...u,
    rank: i + 1,
    weightedPoints: weighted.get(u.userId),
  }));
}

export function sortByDimension(
  users: UserPeriodAgg[],
  dimension: LeaderboardDimension,
  weighted: Map<string, number>,
): RankedRow[] {
  return rankAllUsers(users, dimension, weighted).slice(0, LEADERBOARD_LIMIT);
}

/** 群組 vs 群組：以成員期間聚合後，對群組取平均標準化分、平均完成數、SDG 覆蓋等 */
export type GroupPeriodAgg = {
  groupId: string;
  name: string;
  isPublic: boolean;
  memberCount: number;
  /** 成員「期間平均標準化分」再對人數平均（無打卡者視為 0） */
  avgNormalized: number;
  /** 期間內群組總完成數 ÷ 成員數 */
  avgCompletedPerMember: number;
  /** 成員在期間內單日 SDG 覆蓋數之最大 */
  maxSdgCoverage: number;
};

export type GroupRankedRow = GroupPeriodAgg & {
  rank: number;
  weightedPoints?: number;
};

export function computeWeightedRanksForGroups(
  groups: GroupPeriodAgg[],
): Map<string, number> {
  const n = groups.length;
  if (n === 0) return new Map();
  const byScore = [...groups].sort((a, b) => b.avgNormalized - a.avgNormalized);
  const byCount = [...groups].sort(
    (a, b) => b.avgCompletedPerMember - a.avgCompletedPerMember,
  );
  const bySdg = [...groups].sort(
    (a, b) => b.maxSdgCoverage - a.maxSdgCoverage,
  );

  const out = new Map<string, number>();
  for (const g of groups) {
    const rs = byScore.findIndex((x) => x.groupId === g.groupId) + 1;
    const rc = byCount.findIndex((x) => x.groupId === g.groupId) + 1;
    const rd = bySdg.findIndex((x) => x.groupId === g.groupId) + 1;
    out.set(
      g.groupId,
      linearPoints(rs, n) + linearPoints(rc, n) + linearPoints(rd, n),
    );
  }
  return out;
}

export function sortGroupsByDimension(
  groups: GroupPeriodAgg[],
  dimension: LeaderboardDimension,
  weighted: Map<string, number>,
): GroupRankedRow[] {
  const sorted = [...groups];
  if (dimension === "score") {
    sorted.sort((a, b) => b.avgNormalized - a.avgNormalized);
  } else if (dimension === "count") {
    sorted.sort((a, b) => b.avgCompletedPerMember - a.avgCompletedPerMember);
  } else if (dimension === "sdg") {
    sorted.sort((a, b) => b.maxSdgCoverage - a.maxSdgCoverage);
  } else {
    sorted.sort(
      (a, b) =>
        (weighted.get(b.groupId) ?? 0) - (weighted.get(a.groupId) ?? 0),
    );
  }

  return sorted.slice(0, LEADERBOARD_LIMIT).map((u, i) => ({
    ...u,
    rank: i + 1,
    weightedPoints: weighted.get(u.groupId),
  }));
}
