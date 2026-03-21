/** 分數與 streak（對應 INSTRUCTIONS.md） */

export const DEFAULT_ITEM_POINTS = 10; // 每個行動（公版或自訂）的預設得分

/** streak tier 加成，min = 最低連續天數（含） */
export const STREAK_TIERS = [
  { min: 1, bonus: 5 },
  { min: 7, bonus: 15 },
  { min: 14, bonus: 30 },
  { min: 30, bonus: 50 },
] as const;
