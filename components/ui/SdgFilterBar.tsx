"use client";

import { SDG_COLORS } from "@/constants/sdg";
import { X } from "lucide-react";

const IDS = Array.from({ length: 17 }, (_, i) => i + 1);

type Props = {
  /** 空集合＝不篩選（顯示全部） */
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  className?: string;
};

export function SdgFilterBar({ selected, onChange, className }: Props) {
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const clear = () => onChange(new Set());

  return (
    <div
      className={[
        "rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-white)]/90 p-2 shadow-sm",
        className ?? "",
      ].join(" ")}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-secondary)]">
          篩選 SDG
        </span>
        {selected.size > 0 ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            全部
          </button>
        ) : (
          <span className="text-[12px] text-[var(--color-subtle)]">未選＝全部</span>
        )}
      </div>
      <div className="flex max-w-full gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
        {IDS.map((id) => {
          const on = selected.has(id);
          const c = SDG_COLORS[id];
          const bg = c?.bg ?? "var(--color-muted)";
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={[
                "shrink-0 rounded-full border-[0.5px] px-2.5 py-1.5 text-[12px] font-semibold transition",
                on
                  ? "border-[var(--color-primary-strong)] ring-1 ring-[var(--color-primary-strong)]/35"
                  : "border-transparent opacity-80 hover:opacity-100",
              ].join(" ")}
              style={{
                backgroundColor: on ? bg : `${bg}99`,
                color: c?.text ?? "var(--color-ink)",
              }}
              aria-pressed={on}
            >
              {id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
