import { getSdgById } from "@/constants/sdg";

type Props = {
  id: number;
  /**
   * `true`（預設）：與「今日」清單一致，**SDG N** ＋ **`constants/sdg` 簡短中文**。
   * `false`：僅 **SDG N**（極少數緊湊版面用）。
   */
  showLabel?: boolean;
};

export function SdgTag({ id, showLabel = true }: Props) {
  const s = getSdgById(id);
  if (!s) return null;
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-[10px] py-[3px] text-[11px] font-medium leading-tight"
      style={{ background: s.bg, color: s.text }}
    >
      {showLabel ? `SDG ${id} ${s.label}` : `SDG ${id}`}
    </span>
  );
}
