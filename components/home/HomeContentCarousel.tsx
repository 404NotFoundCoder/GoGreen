"use client";

import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

const OUTER_SLIDES = 2;
const HOW_CARDS = 3;

function PhilosophyBlock() {
  return (
    <>
      <p className="text-[0.95rem] leading-relaxed text-[var(--color-ink)] sm:text-base">
        <span className="font-semibold text-[var(--color-primary-dark)]">
          GoGreen
        </span>
        相信行動比口號重要。
      </p>
      <p className="mt-5 text-[0.95rem] leading-[1.75] text-[var(--color-ink-secondary)] sm:text-base sm:leading-relaxed">
        快來試試：以聯合國{" "}
        <span className="font-semibold text-[var(--color-ink)]">SDG</span>
        為核心的每日檢核——打卡集點、連續挑戰，和朋友一起累積改變。
      </p>
      <div
        className="mx-auto my-6 max-w-[min(12rem,40%)] border-t-[0.5px] border-[var(--color-muted)]"
        aria-hidden
      />
      <p className="text-[0.95rem] leading-[1.75] text-[var(--color-ink-secondary)] sm:text-base sm:leading-relaxed">
        透過清楚的{" "}
        <span className="font-semibold text-[var(--color-ink)]">SDG</span>
        標籤與可追蹤的每日紀錄，讓你能看見自己的影響力，也讓「做環保」變得具體、有趣、可延續。
      </p>
    </>
  );
}

const HOW_ITEMS = [
  {
    icon: Target,
    title: "今日任務",
    desc: "公版＋自訂行動，點一下完成打卡",
  },
  {
    icon: Trophy,
    title: "分數與連勝",
    desc: "累積得分、連續天數，解鎖排行榜成就感",
  },
  {
    icon: Users,
    title: "揪團成長",
    desc: "加入群組，和同伴一起比進度、互相激勵",
  },
] as const;

function HowToPlayHeader() {
  return (
    <>
      <div className="flex items-center justify-center gap-2 text-[var(--color-ink)] md:justify-start">
        <Sparkles
          className="h-5 w-5 shrink-0 text-[var(--color-primary-dark)]"
          aria-hidden
        />
        <h2 className="text-lg font-semibold md:text-xl">怎麼玩？</h2>
      </div>
      <p className="mt-2 text-center text-sm leading-relaxed text-[var(--color-ink-secondary)] md:text-left">
        不用一次改變全世界——從今天的小行動開始，累積看得見的進度。
      </p>
    </>
  );
}

function HowToPlayCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: (typeof HOW_ITEMS)[number]["icon"];
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] p-4 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-[var(--color-primary-dark)]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-secondary)]">
        {desc}
      </p>
    </div>
  );
}

/** 手機：理念卡底部，三張玩法卡橫向滑動 */
function HowToPlayHorizontalMobile() {
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback((n: number) => {
    setI((x) => Math.max(0, Math.min(HOW_CARDS - 1, n)));
  }, []);

  const prev = useCallback(() => go(i - 1), [go, i]);
  const next = useCallback(() => go(i + 1), [go, i]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 48) prev();
    else if (dx < -48) next();
  };

  return (
    <div className="mt-8 border-t-[0.5px] border-[var(--color-muted)] pt-8">
      <HowToPlayHeader />
      <div
        className="mt-5 overflow-hidden rounded-xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `${HOW_CARDS * 100}%`,
            transform: `translateX(-${(i * 100) / HOW_CARDS}%)`,
          }}
        >
          {HOW_ITEMS.map((item) => (
            <div
              key={item.title}
              className="shrink-0 px-1"
              style={{ width: `${100 / HOW_CARDS}%` }}
            >
              <HowToPlayCard {...item} />
            </div>
          ))}
        </div>
      </div>
      <div
        className="mt-4 flex justify-center gap-2"
        role="tablist"
        aria-label="玩法步驟"
      >
        {HOW_ITEMS.map((_, idx) => (
          <button
            key={idx}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`第 ${idx + 1} 步`}
            onClick={() => go(idx)}
            className={[
              "h-2 w-2 rounded-full transition-colors",
              i === idx
                ? "bg-[var(--color-primary-dark)]"
                : "bg-[var(--color-muted)]",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

/** 桌面：外層第二頁 — 三欄網格 */
function HowToPlayGridDesktop() {
  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <HowToPlayHeader />
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {HOW_ITEMS.map((item) => (
          <li key={item.title}>
            <HowToPlayCard {...item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomeContentCarousel() {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setIndex((x) => Math.max(0, Math.min(OUTER_SLIDES - 1, next)));
  }, []);

  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 56) prev();
    else if (dx < -56) next();
  };

  return (
    <div className="relative mx-auto mt-10 w-full max-w-2xl" id="how-it-works">
      {/* 手機：單卡 + 底部橫向「怎麼玩」，不外層輪播 */}
      <div className="md:hidden">
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-5 py-7 text-center">
          <PhilosophyBlock />
          <HowToPlayHorizontalMobile />
        </div>
      </div>

      {/* 桌面：外層兩頁輪播 */}
      <div className="relative hidden md:block">
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10">
          <div className="relative mx-auto h-full max-w-2xl">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              aria-label="上一則"
              className="pointer-events-auto absolute top-1/2 -left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-primary-dark)] transition hover:bg-[var(--color-primary-light)] disabled:pointer-events-none disabled:opacity-30 lg:-left-4"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={index === OUTER_SLIDES - 1}
              aria-label="下一則"
              className="pointer-events-auto absolute top-1/2 -right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] text-[var(--color-primary-dark)] transition hover:bg-[var(--color-primary-light)] disabled:pointer-events-none disabled:opacity-30 lg:-right-4"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `${OUTER_SLIDES * 100}%`,
              transform: `translateX(-${(index * 100) / OUTER_SLIDES}%)`,
            }}
          >
            <div
              className="shrink-0 px-5 py-7 text-center sm:px-8 sm:py-8"
              style={{ width: `${100 / OUTER_SLIDES}%` }}
            >
              <PhilosophyBlock />
            </div>
            <div
              className="shrink-0"
              style={{ width: `${100 / OUTER_SLIDES}%` }}
            >
              <HowToPlayGridDesktop />
            </div>
          </div>
        </div>

        <div
          className="mt-5 flex justify-center gap-2"
          role="tablist"
          aria-label="輪播頁碼"
        >
          {Array.from({ length: OUTER_SLIDES }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={index === i}
              aria-label={`第 ${i + 1} 頁`}
              onClick={() => go(i)}
              className={[
                "h-2.5 w-2.5 rounded-full transition-colors",
                index === i
                  ? "bg-[var(--color-primary-dark)]"
                  : "bg-[var(--color-muted)] hover:bg-[var(--color-subtle)]",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
