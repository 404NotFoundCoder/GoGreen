"use client";

import { Leaf } from "lucide-react";
import Link from "next/link";

type Props = {
  className?: string;
  /** 點擊導向首頁或今日（App 內預設 /today） */
  href?: string;
  /** 僅顯示葉子，不顯示文字 */
  iconOnly?: boolean;
  /** `hero`：首頁大型品牌；`nav`：側欄／頂欄 */
  size?: "nav" | "hero";
};

/** 品牌識別：葉子圖示 + GoGreen（葉子為主 logo） */
export function BrandMark({
  className = "",
  href = "/",
  iconOnly = false,
  size = "nav",
}: Props) {
  const isHero = size === "hero";
  const leafSize = iconOnly ? 28 : isHero ? 56 : 36;
  const wordClass = isHero
    ? "text-[2.5rem] font-bold leading-none tracking-tight text-[var(--color-ink)] sm:text-5xl"
    : "text-xl font-semibold tracking-tight text-[var(--color-ink)]";

  const inner = (
    <span
      className={`inline-flex items-center gap-2 sm:gap-3 ${className}`}
    >
      <Leaf
        className="shrink-0 text-[var(--color-primary-dark)]"
        strokeWidth={isHero ? 2 : 2.2}
        aria-hidden
        size={leafSize}
      />
      {iconOnly ? null : (
        <span className={wordClass}>GoGreen</span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
