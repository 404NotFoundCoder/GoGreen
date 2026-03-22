"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { RankMark } from "@/components/leaderboard/RankMark";
import { SdgTag } from "@/components/ui/SdgTag";
import { TIMEZONE } from "@/constants/config";
import { SDG_COLORS } from "@/constants/sdg";
import type { DailyCompletionPoint } from "@/lib/supabase/leaderboardAnalytics";
import type { RankedRow } from "@/lib/utils/leaderboard";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 曆日座標：X 軸顯示「月/日」；非 ISO 日期（如四週彙總）沿用後端 label */
function chartXLabel(p: DailyCompletionPoint): string {
  if (ISO_DATE.test(p.date)) {
    return formatInTimeZone(
      parseISO(`${p.date}T12:00:00`),
      TIMEZONE,
      "M/d",
    );
  }
  return p.label;
}

/** 每點最小水平間距：點位多時外層橫向捲動 */
const LINE_POINT_MIN_PX = 28;
const CHART_VIEW_H = 200;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 36;

function niceYMax(maxVal: number): number {
  if (maxVal <= 0) return 1;
  if (maxVal <= 5) return 5;
  if (maxVal <= 10) return 10;
  const pow10 = 10 ** Math.floor(Math.log10(maxVal));
  const n = maxVal / pow10;
  const up = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return up * pow10;
}

function yTicks(ymax: number): number[] {
  if (ymax <= 1) return [0, 1];
  const step =
    ymax <= 10
      ? ymax <= 5
        ? 1
        : 2
      : ymax <= 40
        ? 10
        : ymax <= 100
          ? 20
          : Math.max(1, Math.round(ymax / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= ymax + 1e-9; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
    if (ticks.length > 8) break;
  }
  if (ticks[ticks.length - 1]! < ymax) ticks.push(ymax);
  return ticks;
}

type Pt = { x: number; y: number };

function smoothLinePath(points: Pt[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y}`;
  }
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const x0 = i > 0 ? points[i - 1]!.x : points[i]!.x;
    const y0 = i > 0 ? points[i - 1]!.y : points[i]!.y;
    const x1 = points[i]!.x;
    const y1 = points[i]!.y;
    const x2 = points[i + 1]!.x;
    const y2 = points[i + 1]!.y;
    const x3 = i !== points.length - 2 ? points[i + 2]!.x : x2;
    const y3 = i !== points.length - 2 ? points[i + 2]!.y : y2;
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }
  return d;
}

function MemberBarAvatar({
  nickname,
  photoUrl,
}: {
  nickname: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-[var(--color-primary-pale)]"
        referrerPolicy="no-referrer"
      />
    );
  }
  const t = nickname.trim();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-xs font-semibold text-[var(--color-primary-dark)]">
      {t ? t.slice(0, 1) : "?"}
    </div>
  );
}

/** 分數表：各點 `total` 為原始分加總（與後端粒度一致），平滑折線＋面積 */
export function GlobalDailyCompletionBars({
  points,
  valueSuffix = "分",
}: {
  points: DailyCompletionPoint[];
  /** 數值單位，用於 tooltip／無障礙說明 */
  valueSuffix?: string;
}) {
  const areaGradId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setContainerW(el.clientWidth);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [points.length]);

  if (points.length === 0) {
    return (
      <div ref={wrapRef} className="w-full min-w-0">
        <p className="text-sm text-[var(--color-subtle)]">此期間尚無完成資料。</p>
      </div>
    );
  }

  const n = points.length;
  const ymax = niceYMax(Math.max(0, ...points.map((p) => p.total)));
  const ticks = yTicks(ymax);
  const minContentW = PAD_L + PAD_R + Math.max(n * LINE_POINT_MIN_PX, n === 1 ? 100 : 72);
  const plotW = Math.max(
    containerW > 0 ? containerW : minContentW,
    minContentW,
  );
  const innerW = plotW - PAD_L - PAD_R;
  const innerH = CHART_VIEW_H - PAD_T - PAD_B;
  const baseY = PAD_T + innerH;
  const xs = points.map((_, i) =>
    n === 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1),
  );
  const pts: Pt[] = points.map((p, i) => {
    const t = p.total;
    const y =
      ymax <= 0
        ? baseY
        : PAD_T + innerH * (1 - Math.min(1, Math.max(0, t / ymax)));
    return { x: xs[i]!, y };
  });

  const lineD = smoothLinePath(pts);
  const areaD =
    pts.length === 0
      ? ""
      : pts.length === 1
        ? `M ${pts[0]!.x - 14} ${baseY} L ${pts[0]!.x + 14} ${baseY} L ${pts[0]!.x} ${pts[0]!.y} Z`
        : `${lineD} L ${pts[pts.length - 1]!.x} ${baseY} L ${pts[0]!.x} ${baseY} Z`;

  const xLabelFontPx = n > 14 ? 9 : 10;

  return (
    <div ref={wrapRef} className="w-full min-w-0" style={{ minWidth: plotW }}>
      <svg
        role="img"
        aria-label={`期間原始分趨勢，共 ${n} 個資料點`}
        width={plotW}
        height={CHART_VIEW_H}
        className="block max-w-none text-[var(--color-primary-strong)]"
        viewBox={`0 0 ${plotW} ${CHART_VIEW_H}`}
      >
        <defs>
          <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-primary-strong)"
              stopOpacity="0.22"
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary-strong)"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>

        {ticks.map((tv) => {
          const gy =
            ymax <= 0
              ? baseY
              : PAD_T + innerH * (1 - Math.min(1, tv / ymax));
          return (
            <g key={tv}>
              <line
                x1={PAD_L}
                y1={gy}
                x2={plotW - PAD_R}
                y2={gy}
                stroke="var(--color-muted)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
              <text
                x={PAD_L - 6}
                y={gy + 4}
                textAnchor="end"
                className="fill-[var(--color-subtle)]"
                style={{ fontSize: 10 }}
              >
                {Number.isInteger(tv) ? tv : tv.toFixed(1)}
              </text>
            </g>
          );
        })}

        {areaD ? (
          <path d={areaD} fill={`url(#${areaGradId})`} stroke="none" />
        ) : null}
        {lineD ? (
          <path
            d={lineD}
            fill="none"
            stroke="var(--color-primary-strong)"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((p, i) => {
          const cx = pts[i]!.x;
          const cy = pts[i]!.y;
          return (
            <g key={p.date}>
              <title>{`${p.date}：${p.total} ${valueSuffix}`}</title>
              <circle
                cx={cx}
                cy={cy}
                r={4.5}
                fill="var(--color-primary-strong)"
                stroke="var(--color-white)"
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {points.map((p, i) => (
          <text
            key={`xl-${p.date}`}
            x={xs[i]!}
            y={CHART_VIEW_H - 10}
            textAnchor="middle"
            className="fill-[var(--color-subtle)]"
            style={{ fontSize: xLabelFontPx }}
          >
            {chartXLabel(p)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function SdgDistributionBars({
  rows,
}: {
  rows: { sdgId: number; count: number }[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-subtle)]">尚無 SDG 打卡次數。</p>
    );
  }
  const total = rows.reduce((s, r) => s + r.count, 0);
  const denom = Math.max(1, total);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const meta = SDG_COLORS[r.sdgId];
        const pct = Math.round((r.count / denom) * 1000) / 10;
        const barPct = Math.min(100, (r.count / denom) * 100);
        const accent = meta?.text ?? "var(--color-primary-dark)";
        return (
          <li key={r.sdgId}>
            <div className="mb-0.5 flex justify-between gap-2 text-xs">
              <div className="min-w-0 max-w-[78%] shrink">
                <SdgTag id={r.sdgId} showLabel />
              </div>
              <span className="shrink-0 tabular-nums font-semibold text-[var(--color-ink)]">
                {pct}%
                <span className="ml-1 font-normal text-[var(--color-ink-secondary)]">
                  （{r.count} 次）
                </span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--color-surface)] shadow-inner shadow-black/5">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${barPct}%`,
                  background: `linear-gradient(90deg, ${accent}cc 0%, ${accent} 55%, ${accent}f2 100%)`,
                  boxShadow: `2px 0 8px -1px ${accent}99`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function GroupMemberCountBars({ rows }: { rows: RankedRow[] }) {
  const list = rows.slice(0, 12);
  const max = Math.max(1, ...list.map((r) => r.totalCompleted));
  if (list.length === 0) return null;
  return (
    <div className="space-y-2">
      {list.map((r) => (
        <div
          key={r.userId}
          className="flex items-center justify-between gap-2 text-sm sm:gap-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex w-7 shrink-0 items-center justify-center">
              <RankMark rank={r.rank} size="sm" />
            </div>
            <MemberBarAvatar nickname={r.nickname} photoUrl={r.photoUrl} />
            <span className="min-w-0 truncate text-[var(--color-ink)]">
              {r.nickname}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-[var(--color-white)] sm:block">
              <div
                className="h-full rounded-full bg-[var(--color-primary-pale)]"
                style={{ width: `${(r.totalCompleted / max) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right tabular-nums text-[var(--color-ink-secondary)]">
              {r.totalCompleted} 項
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
