"use client";

import { Crown } from "lucide-react";

type RankMarkProps = {
  rank: number;
  /** 主列表列用 md；圖表內小列用 sm */
  size?: "md" | "sm";
};

/**
 * 第 1–3 名：金／銀／銅色調皇冠，數字置中；第 4 名起：僅數字，不用金銀銅色。
 * 不使用漸層（與設計系統一致）。
 */
export function RankMark({ rank, size = "md" }: RankMarkProps) {
  const podium = rank >= 1 && rank <= 3;

  if (podium) {
    const crownStroke =
      rank === 1
        ? "text-amber-500"
        : rank === 2
          ? "text-slate-400"
          : "text-orange-900";
    const numClass =
      rank === 1
        ? "text-amber-950"
        : rank === 2
          ? "text-slate-800"
          : "text-orange-950";

    if (size === "sm") {
      return (
        <span
          className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center"
          aria-label={`第 ${rank} 名`}
        >
          <Crown
            className={`absolute h-5 w-5 ${crownStroke}`}
            strokeWidth={1.75}
            aria-hidden
          />
          <span
            className={`relative z-[1] mt-px text-[10px] font-bold tabular-nums leading-none ${numClass}`}
          >
            {rank}
          </span>
        </span>
      );
    }

    return (
      <span
        className="relative flex h-11 w-11 shrink-0 items-center justify-center"
        aria-label={`第 ${rank} 名`}
      >
        <Crown
          className={`absolute h-10 w-10 ${crownStroke}`}
          strokeWidth={1.5}
          aria-hidden
        />
        <span
          className={`relative z-[1] mt-0.5 text-xs font-bold tabular-nums leading-none ${numClass}`}
        >
          {rank}
        </span>
      </span>
    );
  }

  if (size === "sm") {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface-mid)] text-[10px] font-bold tabular-nums text-[var(--color-ink)]"
        aria-label={`第 ${rank} 名`}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className="flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface-mid)] px-2 text-sm font-bold tabular-nums text-[var(--color-ink)]"
      aria-label={`第 ${rank} 名`}
    >
      {rank}
    </span>
  );
}
