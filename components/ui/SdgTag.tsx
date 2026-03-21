import { getSdgById } from "@/constants/sdg";

export function SdgTag({ id }: { id: number }) {
  const s = getSdgById(id);
  if (!s) return null;
  return (
    <span
      className="inline-flex min-h-[22px] items-center rounded-full px-2 py-0.5 text-xs font-medium leading-tight"
      style={{ backgroundColor: s.color, color: s.textColor }}
    >
      SDG {id}
    </span>
  );
}
