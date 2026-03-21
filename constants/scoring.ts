/** 分數與 streak（對應 INSTRUCTIONS.md） */

export const DEFAULT_ITEM_POINTS = 10; // 每個行動（公版或自訂）的預設得分

/** streak tier 加成，min = 最低連續天數（含） */
export const STREAK_TIERS = [
  { min: 1, bonus: 5 },
  { min: 7, bonus: 15 },
  { min: 14, bonus: 30 },
  { min: 30, bonus: 50 },
] as const;

/** 依目前連續天數回傳所屬 tier 的 streak 加成（顯示於今日檢核統計區） */
export function getStreakTierBonus(streakDays: number): number {
  if (streakDays < 1) return 0;
  let bonus = 0;
  for (const t of STREAK_TIERS) {
    if (streakDays >= t.min) bonus = t.bonus;
  }
  return bonus;
}
