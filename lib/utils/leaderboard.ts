import { LEADERBOARD_LIMIT } from "@/constants/config";
import { DEFAULT_ITEM_POINTS, getStreakTierBonus } from "@/constants/scoring";

export type LeaderboardPeriod = "week" | "month" | "all";
export type LeaderboardDimension = "weighted" | "score" | "count" | "sdg";

/** 期間內各 tier 加成值出現的天數（用於列表說明） */
export type StreakTierBonusPart = { bonus: number; days: number };

export type UserPeriodAgg = {
  userId: string;
  nickname: string;
  /** 期間內分數加總（各完成項 points，`user_daily_stats.raw_score` 日加總） */
  totalRawScore: number;
  /** 期間內完成項目數加總（打卡筆數） */
  totalCompleted: number;
  /** 期間內公版項目打卡次數（`rpc_leaderboard_user_checkin_split`） */
  templateCheckins: number;
  /** 期間內自訂項目打卡次數 */
  customCheckins: number;
  /** 期間內每日 Streak Tier 加成加總（依當日 streak 對應 tier） */
  totalTierBonusSum: number;
  /** 各日 tier 加成拆項（例 5×12日 + 15×2日） */
  streakTierBonusParts: StreakTierBonusPart[];
  /** 期間內單日 SDG 涵蓋數之最大（M） */
  maxSdgCoverage: number;
  /** 所選期間內曾涵蓋之相異 SDG 數（N，= coveredSdgIds.length） */
  sdgUnionCount: number;
  /** 期間內曾涵蓋的 SDG 目標編號（由 RPC 彙總 checkins） */
  coveredSdgIds: number[];
};

/** 總加權在三個維度各自的線性積分（與 `weightedPoints` 之和一致） */
export type WeightedBreakdown = {
  scorePts: number;
  countPts: number;
  sdgPts: number;
};

export type RankedRow = UserPeriodAgg & {
  rank: number;
  weightedPoints?: number;
  weightedBreakdown?: WeightedBreakdown;
};

export function linearPoints(rank: number, n: number): number {
  if (n <= 0) return 0;
  return Math.max(0, n - rank + 1);
}

/** SDG 維度排名與總加權：N（期間相異數）+ M（單日最多） */
export function sdgRankSum(
  row: Pick<UserPeriodAgg, "sdgUnionCount" | "maxSdgCoverage">,
): number {
  return row.sdgUnionCount + row.maxSdgCoverage;
}

/** 由「每日 tier 加成值」計次轉成列表用拆項（高 bonus 先） */
export function buildStreakTierBonusPartsFromHistogram(
  hist: Map<number, number>,
): StreakTierBonusPart[] {
  const order = [50, 30, 15, 5, 0];
  return order
    .map((bonus) => ({ bonus, days: hist.get(bonus) ?? 0 }))
    .filter((x) => x.days > 0 && x.bonus > 0);
}

/** 列表副標：Streak Tier 加成算式（細節與範例見「排序依據」） */
export function formatStreakTierBonusSubline(
  parts: StreakTierBonusPart[],
  total: number,
): string {
  if (parts.length === 0) {
    return `加成加總 ${total}（期間無可計算之打卡日）`;
  }
  const formula = parts.map((p) => `${p.bonus}×${p.days}日`).join(" + ");
  return `加成加總 ${total}＝${formula}`;
}

/** 列表副標：分數（預設每完成一項 10 分） */
export function formatScoreSubline(row: UserPeriodAgg): string {
  const actual = Math.round(row.totalRawScore);
  const pts = DEFAULT_ITEM_POINTS;
  const t = row.templateCheckins;
  const c = row.customCheckins;
  const n = row.totalCompleted;
  const sumTc = t + c;

  if (n === 0 && actual === 0) {
    return "分數 0（期間無完成）";
  }

  if (sumTc > 0 && sumTc === n) {
    const expected = sumTc * pts;
    if (actual === expected) {
      return `分數 ${actual}＝(公版 ${t} 次 + 自訂 ${c} 次) × ${pts} 分；共 ${n} 次完成（不含 Streak Tier 加成）。`;
    }
    return `分數 ${actual}；（公版 ${t} + 自訂 ${c}）× ${pts}＝${expected} 為參考，實際加總含各項 points（與 ${expected} 可能不同）。`;
  }

  return `分數 ${actual}＝${n} 次完成 × ${pts} 分（不含 Streak Tier 加成；公版／自訂筆數於資料同步後會顯示）。`;
}

/** 依三維度名次計算各維度線性積分 */
export function computeWeightedBreakdown(
  users: UserPeriodAgg[],
): Map<string, WeightedBreakdown> {
  const n = users.length;
  if (n === 0) return new Map();
  const byScore = [...users].sort((a, b) => b.totalRawScore - a.totalRawScore);
  const byCount = [...users].sort(
    (a, b) => b.totalTierBonusSum - a.totalTierBonusSum,
  );
  const bySdg = [...users].sort((a, b) => b.sdgUnionCount - a.sdgUnionCount);

  const out = new Map<string, WeightedBreakdown>();
  for (const u of users) {
    const rs = byScore.findIndex((x) => x.userId === u.userId) + 1;
    const rc = byCount.findIndex((x) => x.userId === u.userId) + 1;
    const rd = bySdg.findIndex((x) => x.userId === u.userId) + 1;
    out.set(u.userId, {
      scorePts: linearPoints(rs, n),
      countPts: linearPoints(rc, n),
      sdgPts: linearPoints(rd, n),
    });
  }
  return out;
}

/** 依三維度名次計算總加權（線性積分） */
export function computeWeightedRanks(
  users: UserPeriodAgg[],
): Map<string, number> {
  const bd = computeWeightedBreakdown(users);
  const out = new Map<string, number>();
  for (const [uid, b] of bd) {
    out.set(uid, b.scorePts + b.countPts + b.sdgPts);
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
    sorted.sort((a, b) => b.totalRawScore - a.totalRawScore);
  } else if (dimension === "count") {
    sorted.sort((a, b) => b.totalTierBonusSum - a.totalTierBonusSum);
  } else if (dimension === "sdg") {
    sorted.sort((a, b) => sdgRankSum(b) - sdgRankSum(a));
  } else {
    sorted.sort(
      (a, b) =>
        (weighted.get(b.userId) ?? 0) - (weighted.get(a.userId) ?? 0),
    );
  }

  const breakdown = computeWeightedBreakdown(users);
  return sorted.map((u, i) => ({
    ...u,
    rank: i + 1,
    weightedPoints: weighted.get(u.userId),
    weightedBreakdown: breakdown.get(u.userId),
  }));
}

export function sortByDimension(
  users: UserPeriodAgg[],
  dimension: LeaderboardDimension,
  weighted: Map<string, number>,
): RankedRow[] {
  return rankAllUsers(users, dimension, weighted).slice(0, LEADERBOARD_LIMIT);
}

/** 群組 vs 群組：以成員期間聚合後，對群組取平均原始分、平均完成數、SDG 覆蓋等 */
export type GroupPeriodAgg = {
  groupId: string;
  name: string;
  isPublic: boolean;
  memberCount: number;
  /** 成員期間分數加總之平均（無打卡者視為 0） */
  avgRawScorePerMember: number;
  /** 成員期間 Streak Tier 加成加總之平均 */
  avgTierBonusPerMember: number;
  /** 期間內群組總完成數 ÷ 成員數 */
  avgCompletedPerMember: number;
  /** 成員在該期間各自 N+M 後，於群內取平均（相異 SDG 數 + 單日最多） */
  avgSdgRankPerMember: number;
  /** 成員 `totalRawScore` 加總（副標「加總÷人數」分子） */
  sumMemberRawScore: number;
  /** 成員 `totalTierBonusSum` 加總 */
  sumMemberTierBonus: number;
  /** 成員各自 N+M 加總 */
  sumMemberSdgRank: number;
  /** 成員公版打卡次數加總 */
  sumMemberTemplateCheckins: number;
  /** 成員自訂打卡次數加總 */
  sumMemberCustomCheckins: number;
  /** 成員完成筆數加總 */
  sumMemberCompleted: number;
  /** 群組內各成員 Streak 拆項合併（bonus×日數），供副標說明 */
  groupStreakTierBonusParts: StreakTierBonusPart[];
};

/** 「各群間」列表副標：平均分數（帶成員加總、人數與公版／自訂合計，語意同 `formatScoreSubline`） */
export function formatGroupScoreSubline(row: GroupPeriodAgg): string {
  const avg = row.avgRawScorePerMember;
  const sum = Math.round(row.sumMemberRawScore);
  const n = row.memberCount;
  const pts = DEFAULT_ITEM_POINTS;
  const t = row.sumMemberTemplateCheckins;
  const c = row.sumMemberCustomCheckins;
  const totalComp = row.sumMemberCompleted;
  const sumTc = t + c;

  if (totalComp === 0 && sum === 0) {
    return `平均分數 ${avg.toFixed(1)}＝${sum}÷${n}（成員分數加總÷人數）；期間無完成。`;
  }

  if (sumTc > 0 && sumTc === totalComp) {
    const expected = sumTc * pts;
    if (sum === expected) {
      return `平均分數 ${avg.toFixed(1)}＝${sum}÷${n}（成員分數加總÷人數）；（公版 ${t} 次 + 自訂 ${c} 次）× ${pts} 分；共 ${totalComp} 次完成（不含 Streak Tier 加成）。`;
    }
    return `平均分數 ${avg.toFixed(1)}＝${sum}÷${n}（成員分數加總÷人數）；分數 ${sum}；（公版 ${t} + 自訂 ${c}）× ${pts}＝${expected} 為參考，實際加總含各項 points（與 ${expected} 可能不同）。`;
  }

  return `平均分數 ${avg.toFixed(1)}＝${sum}÷${n}（成員分數加總÷人數）；共 ${totalComp} 次完成 × ${pts} 分（不含 Streak Tier 加成；公版／自訂筆數於資料同步後會顯示）。`;
}

/** 「各群間」列表副標：平均 Streak Tier 加成（帶合計與群組合併拆項） */
export function formatGroupTierBonusSubline(row: GroupPeriodAgg): string {
  const avg = row.avgTierBonusPerMember;
  const sum = Math.round(row.sumMemberTierBonus);
  const n = row.memberCount;
  const parts = row.groupStreakTierBonusParts;
  const mergedDetail =
    parts.length === 0
      ? `群組加成加總 ${sum}（期間無可計算之打卡日）`
      : `群組加成加總 ${sum}＝${parts.map((p) => `${p.bonus}×${p.days}日`).join(" + ")}`;
  return `平均 Streak Tier 加成 ${avg.toFixed(1)}＝${sum}÷${n}（成員「加成加總」之和÷人數）。${mergedDetail}（各成員拆項見全體／群組內榜）。`;
}

/** 「各群間」列表副標：平均 SDG 指標（帶 (N+M) 加總與人數） */
export function formatGroupSdgSubline(row: GroupPeriodAgg): string {
  const avg = row.avgSdgRankPerMember;
  const sum = Math.round(row.sumMemberSdgRank);
  const n = row.memberCount;
  return `平均 SDG 指標 ${avg.toFixed(1)}＝${sum}÷${n}（成員 (N+M) 之和÷人數）。`;
}

export type GroupRankedRow = GroupPeriodAgg & {
  rank: number;
  weightedPoints?: number;
  weightedBreakdown?: WeightedBreakdown;
};

/** 由全體使用者聚合與群組／成員表，組出各群組期間聚合（與 `fetchGroupsLeaderboard` 同構） */
export function buildGroupPeriodAggsFromUserMap(
  userMap: Map<string, UserPeriodAgg>,
  groupsRows: { id: string; name: string; is_public: boolean }[],
  membersByGroup: Map<string, string[]>,
): GroupPeriodAgg[] {
  const groupAggs: GroupPeriodAgg[] = [];
  for (const g of groupsRows) {
    const gid = g.id;
    const members = membersByGroup.get(gid) ?? [];
    if (members.length === 0) continue;

    let sumRaw = 0;
    let sumComp = 0;
    let sumTier = 0;
    let sumSdgRank = 0;
    let sumT = 0;
    let sumC = 0;
    const tierHist = new Map<number, number>();
    for (const uid of members) {
      const u = userMap.get(uid);
      sumRaw += u?.totalRawScore ?? 0;
      sumComp += u?.totalCompleted ?? 0;
      sumTier += u?.totalTierBonusSum ?? 0;
      sumSdgRank += u ? sdgRankSum(u) : 0;
      sumT += u?.templateCheckins ?? 0;
      sumC += u?.customCheckins ?? 0;
      if (u) {
        for (const p of u.streakTierBonusParts) {
          tierHist.set(p.bonus, (tierHist.get(p.bonus) ?? 0) + p.days);
        }
      }
    }
    const groupStreakTierBonusParts =
      buildStreakTierBonusPartsFromHistogram(tierHist);
    const n = members.length;
    groupAggs.push({
      groupId: gid,
      name: g.name,
      isPublic: g.is_public,
      memberCount: n,
      avgRawScorePerMember: sumRaw / n,
      avgTierBonusPerMember: sumTier / n,
      avgCompletedPerMember: sumComp / n,
      avgSdgRankPerMember: n > 0 ? sumSdgRank / n : 0,
      sumMemberRawScore: sumRaw,
      sumMemberTierBonus: sumTier,
      sumMemberSdgRank: sumSdgRank,
      sumMemberTemplateCheckins: sumT,
      sumMemberCustomCheckins: sumC,
      sumMemberCompleted: sumComp,
      groupStreakTierBonusParts,
    });
  }
  return groupAggs;
}

export function computeGroupWeightedBreakdown(
  groups: GroupPeriodAgg[],
): Map<string, WeightedBreakdown> {
  const n = groups.length;
  if (n === 0) return new Map();
  const byScore = [...groups].sort(
    (a, b) => b.avgRawScorePerMember - a.avgRawScorePerMember,
  );
  const byCount = [...groups].sort(
    (a, b) => b.avgTierBonusPerMember - a.avgTierBonusPerMember,
  );
  const bySdg = [...groups].sort(
    (a, b) => b.avgSdgRankPerMember - a.avgSdgRankPerMember,
  );

  const out = new Map<string, WeightedBreakdown>();
  for (const g of groups) {
    const rs = byScore.findIndex((x) => x.groupId === g.groupId) + 1;
    const rc = byCount.findIndex((x) => x.groupId === g.groupId) + 1;
    const rd = bySdg.findIndex((x) => x.groupId === g.groupId) + 1;
    out.set(g.groupId, {
      scorePts: linearPoints(rs, n),
      countPts: linearPoints(rc, n),
      sdgPts: linearPoints(rd, n),
    });
  }
  return out;
}

export function computeWeightedRanksForGroups(
  groups: GroupPeriodAgg[],
): Map<string, number> {
  const bd = computeGroupWeightedBreakdown(groups);
  const out = new Map<string, number>();
  for (const [gid, b] of bd) {
    out.set(gid, b.scorePts + b.countPts + b.sdgPts);
  }
  return out;
}

function sortGroupsInPlace(
  sorted: GroupPeriodAgg[],
  dimension: LeaderboardDimension,
  weighted: Map<string, number>,
): void {
  if (dimension === "score") {
    sorted.sort((a, b) => b.avgRawScorePerMember - a.avgRawScorePerMember);
  } else if (dimension === "count") {
    sorted.sort((a, b) => b.avgTierBonusPerMember - a.avgTierBonusPerMember);
  } else if (dimension === "sdg") {
    sorted.sort(
      (a, b) => b.avgSdgRankPerMember - a.avgSdgRankPerMember,
    );
  } else {
    sorted.sort(
      (a, b) =>
        (weighted.get(b.groupId) ?? 0) - (weighted.get(a.groupId) ?? 0),
    );
  }
}

/** 全體群組完整排名（不截斷），供個人快照「各群間」名次 */
export function rankAllGroups(
  groups: GroupPeriodAgg[],
  dimension: LeaderboardDimension,
  weighted: Map<string, number>,
): GroupRankedRow[] {
  const sorted = [...groups];
  sortGroupsInPlace(sorted, dimension, weighted);
  const breakdown = computeGroupWeightedBreakdown(groups);
  return sorted.map((u, i) => ({
    ...u,
    rank: i + 1,
    weightedPoints: weighted.get(u.groupId),
    weightedBreakdown: breakdown.get(u.groupId),
  }));
}

export function sortGroupsByDimension(
  groups: GroupPeriodAgg[],
  dimension: LeaderboardDimension,
  weighted: Map<string, number>,
): GroupRankedRow[] {
  const sorted = [...groups];
  sortGroupsInPlace(sorted, dimension, weighted);
  const breakdown = computeGroupWeightedBreakdown(groups);
  return sorted.slice(0, LEADERBOARD_LIMIT).map((u, i) => ({
    ...u,
    rank: i + 1,
    weightedPoints: weighted.get(u.groupId),
    weightedBreakdown: breakdown.get(u.groupId),
  }));
}
