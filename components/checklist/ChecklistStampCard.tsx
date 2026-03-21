"use client";

import { SdgTag } from "@/components/ui/SdgTag";
import { Leaf } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const PARTICLE_COLORS = [
  "#87986A",
  "#B5C99A",
  "#CFE1B9",
  "#97A97C",
  "#718355",
];

function triggerSpring(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove("gg-stamp-spring");
  void el.offsetWidth;
  el.classList.add("gg-stamp-spring");
  const cleanup = () => {
    el.classList.remove("gg-stamp-spring");
    el.removeEventListener("animationend", onEnd);
    window.clearTimeout(fallback);
  };
  const onEnd = (e: AnimationEvent) => {
    if (e.animationName !== "spring") return;
    cleanup();
  };
  const fallback = window.setTimeout(cleanup, 400);
  el.addEventListener("animationend", onEnd);
}

/** 與參考 HTML 的 particleFly：--tx / --ty、隨機延遲與時長 */
function spawnParticles(stampEl: HTMLElement | null) {
  if (!stampEl || typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = stampEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 8; i++) {
    const div = document.createElement("div");
    div.className = "gg-stamp-particle-dot";
    const angle = (i / 8) * 360;
    const dist = 44 + Math.random() * 48;
    const tx = Math.cos((angle * Math.PI) / 180) * dist;
    const ty = Math.sin((angle * Math.PI) / 180) * dist;
    const size = 4 + Math.random() * 5;
    div.style.left = `${cx}px`;
    div.style.top = `${cy}px`;
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.background =
      PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    div.style.setProperty("--tx", `${tx}px`);
    div.style.setProperty("--ty", `${ty}px`);
    div.style.animationDelay = `${Math.random() * 0.08}s`;
    div.style.animationDuration = `${0.32 + Math.random() * 0.16}s`;
    document.body.appendChild(div);
    window.setTimeout(() => div.remove(), 650);
  }
}

type Props = {
  done: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title: string;
  description?: string | null;
  metaLine?: ReactNode;
  sdgIds?: number[];
  /** SDG 標籤是否顯示中文標籤（預設顯示） */
  sdgShowLabel?: boolean;
};

export function ChecklistStampCard({
  done,
  disabled,
  onToggle,
  title,
  description,
  metaLine,
  sdgIds,
  sdgShowLabel = true,
}: Props) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const stampZoneRef = useRef<HTMLSpanElement>(null);
  const [stamping, setStamping] = useState(false);
  const [userStamped, setUserStamped] = useState(false);
  const [strikeReady, setStrikeReady] = useState(false);

  const visualDone = done && !stamping;

  useEffect(() => {
    if (!stamping) return;
    const t = window.setTimeout(() => setStamping(false), 300);
    return () => window.clearTimeout(t);
  }, [stamping]);

  useEffect(() => {
    if (!visualDone) {
      setStrikeReady(false);
      return;
    }
    const id = requestAnimationFrame(() => setStrikeReady(true));
    return () => cancelAnimationFrame(id);
  }, [visualDone]);

  const handleClick = () => {
    if (disabled || stamping) return;
    if (done) {
      triggerSpring(cardRef.current);
      onToggle();
      return;
    }
    setUserStamped(true);
    setStamping(true);
    triggerSpring(cardRef.current);
    spawnParticles(stampZoneRef.current);
    onToggle();
  };

  return (
    <button
      ref={cardRef}
      type="button"
      disabled={disabled || stamping}
      onClick={handleClick}
      className={[
        "gg-checklist-row group relative flex w-full min-h-[44px] flex-col gap-2 overflow-visible rounded-[14px] border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-4 py-[0.85rem] text-left transition-[background-color,border-color] duration-200",
        visualDone ? "done" : "",
        stamping ? "stamping" : "",
        strikeReady && visualDone ? "strike-ready" : "",
        userStamped ? "user-stamped" : "",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span ref={stampZoneRef} className="gg-stamp-wrap">
          <span className="gg-stamp-circle" aria-hidden />
          <span className="gg-stamp-leaf">
            <Leaf
              className="text-[var(--color-primary-dark)]"
              strokeWidth={2.2}
              size={36}
              aria-hidden
            />
          </span>
          {stamping ? (
            <span className="gg-stamp-ripple-ring" aria-hidden />
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="gg-checklist-title-wrap">
            <p
              className={[
                "gg-checklist-title relative z-10 text-sm font-medium leading-snug transition-colors duration-200",
                visualDone ? "" : "text-[var(--color-ink)]",
              ].join(" ")}
            >
              {title}
            </p>
          </div>
          {metaLine ? (
            <div className="mt-0.5 text-xs text-[var(--color-ink-secondary)]">
              {metaLine}
            </div>
          ) : null}
          {description ? (
            <p
              className={[
                "gg-checklist-desc mt-1 text-sm leading-relaxed",
                visualDone ? "" : "text-[var(--color-ink-secondary)]",
              ].join(" ")}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {sdgIds?.length ? (
        <div className="mt-[5px] flex flex-wrap gap-1 pl-14">
          {sdgIds.map((id) => (
            <SdgTag key={id} id={id} showLabel={sdgShowLabel} />
          ))}
        </div>
      ) : null}
    </button>
  );
}
