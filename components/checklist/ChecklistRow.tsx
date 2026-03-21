"use client";

import { SdgTag } from "@/components/ui/SdgTag";
import type { ChecklistItemRow } from "@/lib/supabase/checklist";
import { Leaf } from "lucide-react";

type Props = {
  item: ChecklistItemRow;
  done: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function ChecklistRow({ item, done, onToggle, disabled }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={[
        "flex min-h-[44px] w-full flex-col gap-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] p-4 text-left transition-transform motion-safe:duration-200 motion-safe:ease-out",
        "bg-[var(--color-surface)]",
        done
          ? "motion-safe:scale-[0.99] bg-[var(--color-primary-light)]"
          : "active:scale-[0.995]",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)]",
            done
              ? "border-[var(--color-primary-dark)] bg-[var(--color-primary-pale)] text-[var(--color-primary-dark)]"
              : "bg-[var(--color-surface-mid)] text-[var(--color-subtle)]",
          ].join(" ")}
          aria-hidden
        >
          {done ? <Leaf className="h-4 w-4" strokeWidth={2.5} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[var(--color-ink)] leading-tight font-medium">
            {item.title}
          </p>
          {item.description ? (
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
              {item.description}
            </p>
          ) : null}
        </div>
      </div>
      {item.sdg_ids?.length ? (
        <div className="flex flex-wrap gap-1.5 pl-11">
          {item.sdg_ids.map((id) => (
            <SdgTag key={id} id={id} />
          ))}
        </div>
      ) : null}
    </button>
  );
}
