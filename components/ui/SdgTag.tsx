import { getSdgById } from "@/constants/sdg";

type Props = {
  id: number;
  /** `false`：僅「SDG N」；`true`：顯示「SDG N」與中文標籤 */
  showLabel?: boolean;
};

export function SdgTag({ id, showLabel = false }: Props) {
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
