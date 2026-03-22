import { createClient } from "@/lib/supabase/client";
import {
  getMonthStartString,
  getTodayString,
  getWeekStartString,
} from "@/lib/utils/date";
import { getStreakTierBonus } from "@/constants/scoring";
import {
  buildGroupPeriodAggsFromUserMap,
  buildStreakTierBonusPartsFromHistogram,
  computeWeightedRanks,
  computeWeightedRanksForGroups,
  type GroupPeriodAgg,
  type GroupRankedRow,
  type LeaderboardDimension,
  type LeaderboardPeriod,
  rankAllGroups,
  rankAllUsers,
  sdgRankSum,
  sortByDimension,
  sortGroupsByDimension,
  type RankedRow,
  type UserPeriodAgg,
} from "@/lib/utils/leaderboard";
import { getLeaderboardDateBounds } from "@/lib/utils/leaderboardPeriod";

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
  /** 所屬群組於「各群間」榜之名次；未加入群組時為 null */
  groupsRanks: Record<LeaderboardDimension, number | null> | null;
  group: { id: string; name: string } | null;
  /** 期間內累計原始分 */
  periodRawScoreSum: number;
  /** 期間內單日 streak 之最大 */
  maxStreakInPeriod: number;
  /** 有群組的總數（各群間榜分母） */
  totalGroups: number;
  /** 期間內自訂項目：相異項目數、打卡次數 */
  customPeriod: { distinctItems: number; totalCheckins: number };
};

/** 期間內 `user_daily_stats` 列（排行榜聚合用） */
export type LeaderboardDailyStatRow = {
  user_id: string;
  date: string;
  normalized_score: number | null;
  completed_count: number | null;
  sdg_coverage: number | null;
  raw_score: number | null;
  streak: number | null;
};

function aggregateUserList(
  stats: LeaderboardDailyStatRow[],
  nick: Map<string, string>,
): UserPeriodAgg[] {
  const agg = new Map<
    string,
    {
      sumRaw: number;
      totalComp: number;
      sumTier: number;
      maxSdg: number;
      tierHist: Map<number, number>;
    }
  >();

  for (const row of stats) {
    const uid = row.user_id;
    const cur = agg.get(uid) ?? {
      sumRaw: 0,
      totalComp: 0,
      sumTier: 0,
      maxSdg: 0,
      tierHist: new Map<number, number>(),
    };
    cur.sumRaw += Number(row.raw_score ?? 0);
    cur.totalComp += row.completed_count ?? 0;
    const dayBonus = getStreakTierBonus(Number(row.streak ?? 0));
    cur.sumTier += dayBonus;
    const b = dayBonus;
    cur.tierHist.set(b, (cur.tierHist.get(b) ?? 0) + 1);
    cur.maxSdg = Math.max(cur.maxSdg, row.sdg_coverage ?? 0);
    agg.set(uid, cur);
  }

  const list: UserPeriodAgg[] = [];
  for (const [userId, v] of agg) {
    list.push({
      userId,
      nickname: nick.get(userId) ?? "—",
      totalRawScore: v.sumRaw,
      totalCompleted: v.totalComp,
      templateCheckins: 0,
      customCheckins: 0,
      totalTierBonusSum: v.sumTier,
      streakTierBonusParts: buildStreakTierBonusPartsFromHistogram(v.tierHist),
      maxSdgCoverage: v.maxSdg,
      sdgUnionCount: 0,
      coveredSdgIds: [],
    });
  }
  return list;
}

/** 群組榜：以 group_members 全體為準，期間無打卡者仍列入（0 分） */
function mergeMembersWithAgg(
  memberIds: string[],
  aggList: UserPeriodAgg[],
  nick: Map<string, string>,
): UserPeriodAgg[] {
  const byUser = new Map(aggList.map((u) => [u.userId, u]));
  const out: UserPeriodAgg[] = [];
  for (const uid of memberIds) {
    const existing = byUser.get(uid);
    if (existing) {
      out.push(existing);
    } else {
      out.push({
        userId: uid,
        nickname: nick.get(uid) ?? "—",
        totalRawScore: 0,
        totalCompleted: 0,
        templateCheckins: 0,
        customCheckins: 0,
        totalTierBonusSum: 0,
        streakTierBonusParts: [],
        maxSdgCoverage: 0,
        sdgUnionCount: 0,
        coveredSdgIds: [],
      });
    }
  }
  return out;
}

/** 供排行榜與圖表共用：期間內所有使用者的每日統計列 */
export async function fetchLeaderboardDailyStatsForPeriod(
  period: LeaderboardPeriod,
): Promise<LeaderboardDailyStatRow[]> {
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
  return (stats ?? []) as LeaderboardDailyStatRow[];
}

/** 期間內每位使用者曾涵蓋的 SDG 編號（需 migration `rpc_leaderboard_user_sdg_goals`） */
async function fetchLeaderboardUserSdgGoalsMap(
  period: LeaderboardPeriod,
): Promise<Map<string, number[]>> {
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_leaderboard_user_sdg_goals", {
    p_start: start,
    p_end: end,
  });
  if (error) {
    console.warn("rpc_leaderboard_user_sdg_goals:", error.message);
    return new Map();
  }
  const map = new Map<string, number[]>();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    const ids = (row.sdg_ids as number[] | null) ?? [];
    map.set(uid, ids);
  }
  return map;
}

function applyCoveredSdgIds(
  list: UserPeriodAgg[],
  sdgMap: Map<string, number[]>,
): void {
  for (const u of list) {
    u.coveredSdgIds = sdgMap.get(u.userId) ?? [];
    u.sdgUnionCount = u.coveredSdgIds.length;
  }
}

/** 公版／自訂打卡次數（需 migration `rpc_leaderboard_user_checkin_split`） */
async function fetchLeaderboardUserCheckinSplitMap(
  period: LeaderboardPeriod,
): Promise<Map<string, { template: number; custom: number }>> {
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_leaderboard_user_checkin_split",
    {
      p_start: start,
      p_end: end,
    },
  );
  if (error) {
    console.warn("rpc_leaderboard_user_checkin_split:", error.message);
    return new Map();
  }
  const map = new Map<string, { template: number; custom: number }>();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    map.set(uid, {
      template: Number(row.template_count ?? 0),
      custom: Number(row.custom_count ?? 0),
    });
  }
  return map;
}

function applyCheckinSplit(
  list: UserPeriodAgg[],
  splitMap: Map<string, { template: number; custom: number }>,
): void {
  for (const u of list) {
    const s = splitMap.get(u.userId);
    u.templateCheckins = s?.template ?? 0;
    u.customCheckins = s?.custom ?? 0;
  }
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
  const [stats, nick, sdgMap, splitMap] = await Promise.all([
    fetchLeaderboardDailyStatsForPeriod(period),
    fetchNicknameMap(),
    fetchLeaderboardUserSdgGoalsMap(period),
    fetchLeaderboardUserCheckinSplitMap(period),
  ]);
  const list = aggregateUserList(stats, nick);
  applyCoveredSdgIds(list, sdgMap);
  applyCheckinSplit(list, splitMap);
  const weighted = computeWeightedRanks(list);
  const totalParticipants = list.length;
  const rows = sortByDimension(list, dimension, weighted);
  return { rows, totalParticipants };
}

export type GroupPeriodStats = {
  /** 成員期間原始分加總 */
  totalRawScore: number;
  /** 各成員期間 N+M 於群內平均（與「各群間」榜 `avgSdgRankPerMember` 同構） */
  avgSdgRankPerMember: number;
  /** 成員任一日之 streak 最大值 */
  longestStreakInPeriod: number;
  /** 達成最長 streak 的成員（同分取先出現者）；無資料時為 null */
  longestStreakMember: { nickname: string } | null;
  /** 期間完成數最高成員 */
  topMember: { nickname: string; totalCompleted: number } | null;
};

/** 群組內統計（總分、最長 streak、活躍成員等） */
export async function fetchGroupPeriodStats(
  groupId: string,
  period: LeaderboardPeriod,
): Promise<GroupPeriodStats> {
  const [stats, nick, memberIds, sdgMap] = await Promise.all([
    fetchLeaderboardDailyStatsForPeriod(period),
    fetchNicknameMap(),
    fetchGroupMemberIds(groupId),
    fetchLeaderboardUserSdgGoalsMap(period),
  ]);
  const idSet = new Set(memberIds);
  const filteredAgg = aggregateUserList(stats, nick).filter((u) =>
    idSet.has(u.userId),
  );
  const fullList = mergeMembersWithAgg(memberIds, filteredAgg, nick);
  applyCoveredSdgIds(fullList, sdgMap);

  let totalRaw = 0;
  let longestStreak = 0;
  let longestStreakUserId: string | null = null;
  for (const row of stats) {
    if (!idSet.has(row.user_id)) continue;
    totalRaw += Number(row.raw_score ?? 0);
    const s = Number(row.streak ?? 0);
    if (s > longestStreak) {
      longestStreak = s;
      longestStreakUserId = row.user_id;
    }
  }

  let sumSdgRank = 0;
  let top: { nickname: string; totalCompleted: number } | null = null;
  for (const u of fullList) {
    sumSdgRank += sdgRankSum(u);
    if (!top || u.totalCompleted > top.totalCompleted) {
      top = { nickname: u.nickname, totalCompleted: u.totalCompleted };
    }
  }
  const memberCount = fullList.length;
  const avgSdgRank =
    memberCount > 0 ? sumSdgRank / memberCount : 0;

  const longestStreakMember =
    longestStreak > 0 && longestStreakUserId
      ? {
          nickname:
            nick.get(longestStreakUserId) ??
            fullList.find((x) => x.userId === longestStreakUserId)?.nickname ??
            "—",
        }
      : null;

  return {
    totalRawScore: totalRaw,
    avgSdgRankPerMember: avgSdgRank,
    longestStreakInPeriod: longestStreak,
    longestStreakMember,
    topMember: top,
  };
}

/** 單一群組內成員排行（邏輯同全體，僅篩選成員） */
export async function fetchGroupMemberLeaderboard(
  groupId: string,
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
): Promise<GlobalLeaderboardResult> {
  const [stats, nick, memberIds, sdgMap, splitMap] = await Promise.all([
    fetchLeaderboardDailyStatsForPeriod(period),
    fetchNicknameMap(),
    fetchGroupMemberIds(groupId),
    fetchLeaderboardUserSdgGoalsMap(period),
    fetchLeaderboardUserCheckinSplitMap(period),
  ]);
  const idSet = new Set(memberIds);
  const agg = aggregateUserList(stats, nick).filter((u) => idSet.has(u.userId));
  const list = mergeMembersWithAgg(memberIds, agg, nick);
  applyCoveredSdgIds(list, sdgMap);
  applyCheckinSplit(list, splitMap);
  const weighted = computeWeightedRanks(list);
  const totalParticipants = memberIds.length;
  const rows = sortByDimension(list, dimension, weighted);
  return { rows, totalParticipants };
}

/** 群組 vs 群組：依成員期間表現聚合後，以平均標準化分等維度排名 */
export async function fetchGroupsLeaderboard(
  period: LeaderboardPeriod,
  dimension: LeaderboardDimension,
): Promise<GroupsLeaderboardResult> {
  const supabase = createClient();
  const [stats, nick, sdgMap, splitMap] = await Promise.all([
    fetchLeaderboardDailyStatsForPeriod(period),
    fetchNicknameMap(),
    fetchLeaderboardUserSdgGoalsMap(period),
    fetchLeaderboardUserCheckinSplitMap(period),
  ]);
  const userList = aggregateUserList(stats, nick);
  applyCoveredSdgIds(userList, sdgMap);
  applyCheckinSplit(userList, splitMap);
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

  const groupAggs = buildGroupPeriodAggsFromUserMap(
    userMap,
    (groups ?? []).map((g) => ({
      id: g.id as string,
      name: g.name as string,
      is_public: g.is_public as boolean,
    })),
    membersByGroup,
  );

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

/** 期間內自訂打卡：相異自訂項目數、總次數（公版以外） */
export async function fetchUserCustomPeriodStats(
  userId: string,
  period: LeaderboardPeriod,
): Promise<{ distinctItems: number; totalCheckins: number }> {
  const { start, end } = getLeaderboardDateBounds(period);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("custom_item_id")
    .eq("user_id", userId)
    .not("custom_item_id", "is", null)
    .gte("date", start)
    .lte("date", end);
  if (error) throw error;
  const rows = data ?? [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.custom_item_id as string | null;
    if (id) seen.add(id);
  }
  return { distinctItems: seen.size, totalCheckins: rows.length };
}

export async function fetchPersonalLeaderboardSnapshot(
  userId: string,
  period: LeaderboardPeriod,
): Promise<PersonalLeaderboardSnapshot> {
  const supabase = createClient();
  const [stats, nick, sdgMap, splitMap, customPeriod] = await Promise.all([
    fetchLeaderboardDailyStatsForPeriod(period),
    fetchNicknameMap(),
    fetchLeaderboardUserSdgGoalsMap(period),
    fetchLeaderboardUserCheckinSplitMap(period),
    fetchUserCustomPeriodStats(userId, period),
  ]);
  const list = aggregateUserList(stats, nick);
  applyCoveredSdgIds(list, sdgMap);
  applyCheckinSplit(list, splitMap);
  const userMap = new Map(list.map((u) => [u.userId, u]));
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
      groupsRanks: null,
      group: null,
      periodRawScoreSum,
      maxStreakInPeriod,
      totalGroups: 0,
      customPeriod,
    };
  }

  const groupId = memRow.group_id as string;
  const memberIds = await fetchGroupMemberIds(groupId);
  const idSet = new Set(memberIds);
  const groupList = mergeMembersWithAgg(
    memberIds,
    list.filter((u) => idSet.has(u.userId)),
    nick,
  );
  applyCoveredSdgIds(groupList, sdgMap);

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

  const [{ data: gmAll }, { data: groupsAll }] = await Promise.all([
    supabase.from("group_members").select("group_id, user_id"),
    supabase.from("groups").select("id, name, is_public"),
  ]);
  const membersByGroup = new Map<string, string[]>();
  for (const row of gmAll ?? []) {
    const gid = row.group_id as string;
    const uid = row.user_id as string;
    if (!membersByGroup.has(gid)) membersByGroup.set(gid, []);
    membersByGroup.get(gid)!.push(uid);
  }
  const groupAggs = buildGroupPeriodAggsFromUserMap(
    userMap,
    (groupsAll ?? []).map((g) => ({
      id: g.id as string,
      name: g.name as string,
      is_public: g.is_public as boolean,
    })),
    membersByGroup,
  );
  const totalGroups = groupAggs.length;
  const groupsRanks = {} as Record<LeaderboardDimension, number | null>;
  for (const d of ALL_DIMS) {
    const w = computeWeightedRanksForGroups(groupAggs);
    const full = rankAllGroups(groupAggs, d, w);
    const row = full.find((r) => r.groupId === groupId);
    groupsRanks[d] = row ? row.rank : null;
  }

  return {
    myAgg,
    totalParticipants,
    globalRanks,
    groupRanks,
    groupsRanks,
    group: gMeta
      ? { id: gMeta.id as string, name: gMeta.name as string }
      : { id: groupId, name: "群組" },
    periodRawScoreSum,
    maxStreakInPeriod,
    totalGroups,
    customPeriod,
  };
}
