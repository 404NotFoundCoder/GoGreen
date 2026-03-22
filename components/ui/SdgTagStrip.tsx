import { SdgTag } from "@/components/ui/SdgTag";

/**
 * 與「今日」清單一致：**SDG N** ＋ **`constants/sdg` 簡短中文**（`SdgTag` **`showLabel`**）。
 */
export function SdgTagStrip({
  ids,
  className = "flex flex-wrap items-center gap-1.5 px-3 pb-1.5",
}: {
  ids: number[];
  className?: string;
}) {
  const uniq = [
    ...new Set(ids.filter((n) => Number.isFinite(n) && n >= 1 && n <= 17)),
  ].sort((a, b) => a - b);
  if (uniq.length === 0) return null;
  return (
    <div className={className}>
      {uniq.map((id) => (
        <SdgTag key={id} id={id} showLabel />
      ))}
    </div>
  );
}
