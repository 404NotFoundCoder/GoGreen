/** 各項完成率：依 SDG 篩選列（列須與選取 SDG 至少一個交集；未選＝顯示全部） */
export function rowMatchesSdgFilter(
  rowSdgIds: number[] | undefined | null,
  selected: ReadonlySet<number>,
): boolean {
  if (selected.size === 0) return true;
  const ids = rowSdgIds ?? [];
  return ids.some((id) => selected.has(id));
}
