import { createClient } from "@/lib/supabase/client";
import {
  getMonthStartString,
  getTodayString,
  getWeekStartString,
} from "@/lib/utils/date";
import {
  computeWeightedRanks,
  computeWeightedRanksForGroups,
  type GroupPeriodAgg,
  type GroupRankedRow,
  type LeaderboardDimension,
  type LeaderboardPeriod,
  rankAllUsers,
  sortByDimension,
  sortGroupsByDimension,
  type RankedRow,
  type UserPeriodAgg,
} from "@/lib/utils/leaderboard";

export type GlobalLeaderboardResult = {
  rows: RankedRow[];
  /** 該期間內曾出現在 user_daily_stats 的不重複使用者數（榜單僅顯示前 LEADERBOARD_LIMIT 名） */
  totalParticipants: number;
};

export type GroupsLeaderboardResult = {
  rows: GroupRankedRow[];
  totalGroups: number;
};

export type PersonalLeaderboardSnapshot = {
  myAgg: UserPeriodAgg | null;
  totalParticipants: number;
  /** 依四維度之全體名次（含未進前榜者） */
  globalRanks: Record<LeaderboardDimension, number | null>;
  /** 目前所屬群組內名次；未加入群組時為 null */
  groupRanks: Record<LeaderboardDimension, number | null> | null;
  group: { id: string; name: string } | null;
  /** 期間內累計原始分 */
  periodRawScoreSum: number;
  /** 期間內單日 streak 之最大 */
  maxStreakInPeriod: number;
};

type StatRow = {
  user_id: string;
  date: string;
  normalized_score: number | null;
  completed_count: number | null;
  sdg_coverage: number | null;
  raw_score: number | null;
  streak: number | null;
};

function aggregateUserList(
  stats: StatRow[],
  nick: Map<string, string>,
): UserPeriodAgg[] {
  const agg = new Map<
    string,
    { sumNorm: number; days: number; totalComp: number; maxSdg: number }
  >();

  for (const row of stats) {
    const uid = row.user_id;
    const cur = agg.get(uid) ?? {
      sumNorm: 0,
      days: 0,
      totalComp: 0,
      maxSdg: 0,
    };
    cur.sumNorm += Number(row.normalized_score);
    cur.days += 1;
    cur.totalComp += row.completed_count ?? 0;
    cur.maxSdg = Math.max(cur.maxSdg, row.sdg_coverage ?? 0);
    agg.set(uid, cur);
  }

  const list: UserPeriodAgg[] = [];
  for (const [userId, v] of agg) {
    list.push({
      userId,
      nickname: nick.get(userId) ?? "—",
      avgNormalized: v.days ? v.sumNorm / v.days : 0,
      totalCompleted: v.totalComp,
      maxSdgCoverage: v.maxSdg,
    });
  }
  return list;
}

async function fetchStatsInPeriod(period: LeaderboardPeriod): Promise<StatRow[]> {
  const supabase = createClient();
  const today = getTodayString();

  let q = supabase
    .from("user_daily_stats")
    .select(
      "user_id, date, normalized_score, completed_count, sdg_coverage, raw_score, streak",
    )
    .lte("date", today);

  if (period === "week") {
    q = q.gte("date", getWeekStartString());
  } else if (period === "month") {
    q = q.gte("date", getMonthStartString());
  }

  const { data: stats, error } = await q;
  if (error) throw error;
  return (stats ?? []) as StatRow[];
}

async function fetchNicknameMap(): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, nickname");
  if (error) throw error;
  return new Map((users ?? []).map((u) => [u.id as string, u.nickname as string]));
}

async function fetchGroupMemberIds(groupId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string);
}

export async function fetchGlobalLeaderboard(
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
): Promise<GlobalLeaderboardResult> {
  const [stats, nick] = await Promise.all([
    fetchStatsInPeriod(period),
    fetchNicknameMap(),
  ]);
  const list = aggregateUserList(stats, nick);
  const weighted = computeWeightedRanks(list);
  const totalParticipants = list.length;
  const rows = sortByDimension(list, dimension, weighted);
  return { rows, totalParticipants };
}

/** 單一群組內成員排行（邏輯同全體，僅篩選成員） */
export async function fetchGroupMemberLeaderboard(
  groupId: string,
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
): Promise<GlobalLeaderboardResult> {
  const [stats, nick, memberIds] = await Promise.all([
    fetchStatsInPeriod(period),
    fetchNicknameMap(),
    fetchGroupMemberIds(groupId),
  ]);
  const idSet = new Set(memberIds);
  const fullList = aggregateUserList(stats, nick);
  const list = fullList.filter((u) => idSet.has(u.userId));
  const weighted = computeWeightedRanks(list);
  const totalParticipants = list.length;
  const rows = sortByDimension(list, dimension, weighted);
  return { rows, totalParticipants };
}

/** 群組 vs 群組：依成員期間表現聚合後，以平均標準化分等維度排名 */
export async function fetchGroupsLeaderboard(
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
): Promise<GroupsLeaderboardResult> {
  const supabase = createClient();
  const [stats, nick] = await Promise.all([
    fetchStatsInPeriod(period),
    fetchNicknameMap(),
  ]);
  const userList = aggregateUserList(stats, nick);
  const userMap = new Map(userList.map((u) => [u.userId, u]));

  const [{ data: gm, error: gmErr }, { data: groups, error: gErr }] =
    await Promise.all([
      supabase.from("group_members").select("group_id, user_id"),
      supabase.from("groups").select("id, name, is_public"),
    ]);
  if (gmErr) throw gmErr;
  if (gErr) throw gErr;

  const membersByGroup = new Map<string, string[]>();
  for (const row of gm ?? []) {
    const gid = row.group_id as string;
    const uid = row.user_id as string;
    if (!membersByGroup.has(gid)) membersByGroup.set(gid, []);
    membersByGroup.get(gid)!.push(uid);
  }

  const groupAggs: GroupPeriodAgg[] = [];
  for (const g of groups ?? []) {
    const gid = g.id as string;
    const members = membersByGroup.get(gid) ?? [];
    if (members.length === 0) continue;

    let sumNorm = 0;
    let sumComp = 0;
    let maxSdg = 0;
    for (const uid of members) {
      const u = userMap.get(uid);
      sumNorm += u?.avgNormalized ?? 0;
      sumComp += u?.totalCompleted ?? 0;
      maxSdg = Math.max(maxSdg, u?.maxSdgCoverage ?? 0);
    }
    const n = members.length;
    groupAggs.push({
      groupId: gid,
      name: g.name as string,
      isPublic: g.is_public as boolean,
      memberCount: n,
      avgNormalized: sumNorm / n,
      avgCompletedPerMember: sumComp / n,
      maxSdgCoverage: maxSdg,
    });
  }

  const weighted = computeWeightedRanksForGroups(groupAggs);
  const totalGroups = groupAggs.length;
  const rows = sortGroupsByDimension(groupAggs, dimension, weighted);
  return { rows, totalGroups };
}

const ALL_DIMS: LeaderboardDimension[] = [
  "weighted",
  "score",
  "count",
  "sdg",
];

export async function fetchPersonalLeaderboardSnapshot(
  userId: string,
  period: LeaderboardPeriod,
): Promise<PersonalLeaderboardSnapshot> {
  const supabase = createClient();
  const [stats, nick] = await Promise.all([
    fetchStatsInPeriod(period),
    fetchNicknameMap(),
  ]);
  const list = aggregateUserList(stats, nick);
  const totalParticipants = list.length;
  const myAgg = list.find((u) => u.userId === userId) ?? null;

  const myStatRows = stats.filter((s) => s.user_id === userId);
  let periodRawScoreSum = 0;
  let maxStreakInPeriod = 0;
  for (const s of myStatRows) {
    periodRawScoreSum += Number(s.raw_score ?? 0);
    maxStreakInPeriod = Math.max(maxStreakInPeriod, Number(s.streak ?? 0));
  }

  const globalRanks = {} as Record<LeaderboardDimension, number | null>;
  for (const d of ALL_DIMS) {
    const w = computeWeightedRanks(list);
    const full = rankAllUsers(list, d, w);
    const row = full.find((r) => r.userId === userId);
    globalRanks[d] = row ? row.rank : null;
  }

  const { data: memRow } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!memRow?.group_id) {
    return {
      myAgg,
      totalParticipants,
      globalRanks,
      groupRanks: null,
      group: null,
      periodRawScoreSum,
      maxStreakInPeriod,
    };
  }

  const groupId = memRow.group_id as string;
  const memberIds = await fetchGroupMemberIds(groupId);
  const idSet = new Set(memberIds);
  const groupList = list.filter((u) => idSet.has(u.userId));

  const { data: gMeta } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", groupId)
    .single();

  const groupRanks = {} as Record<LeaderboardDimension, number | null>;
  for (const d of ALL_DIMS) {
    const w = computeWeightedRanks(groupList);
    const full = rankAllUsers(groupList, d, w);
    const row = full.find((r) => r.userId === userId);
    groupRanks[d] = row ? row.rank : null;
  }

  return {
    myAgg,
    totalParticipants,
    globalRanks,
    groupRanks,
    group: gMeta
      ? { id: gMeta.id as string, name: gMeta.name as string }
      : { id: groupId, name: "群組" },
    periodRawScoreSum,
    maxStreakInPeriod,
  };
}
