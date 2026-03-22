/** 展開「各項完成率」列時快取密度圖 + 佐證日，避免重複點列都等網路 */

export type ExpandDensitySnapshot = {
  densityMap: Map<string, number>;
  photoMarkDates: Set<string>;
};

export function expandDensityCacheKey(args: {
  rowKeyStr: string;
  start: string;
  end: string;
  /** 靜默重抓 epoch，打卡／上傳後遞增以略過過期快取 */
  listSilentEpoch: number;
  groupId?: string | null;
}): string {
  const g =
    args.groupId != null && args.groupId !== ""
      ? `${args.groupId}|`
      : "";
  return `${g}${args.rowKeyStr}|${args.start}|${args.end}|${args.listSilentEpoch}`;
}

export function snapshotExpandDensity(
  densityMap: Map<string, number>,
  photoMarkDates: Set<string>,
): ExpandDensitySnapshot {
  return {
    densityMap: new Map(densityMap),
    photoMarkDates: new Set(photoMarkDates),
  };
}

export function cloneExpandDensity(s: ExpandDensitySnapshot): ExpandDensitySnapshot {
  return {
    densityMap: new Map(s.densityMap),
    photoMarkDates: new Set(s.photoMarkDates),
  };
}
