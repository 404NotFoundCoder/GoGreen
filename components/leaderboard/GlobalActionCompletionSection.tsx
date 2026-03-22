"use client";

import { ActionCompletionParticipantEvidence } from "@/components/leaderboard/ActionCompletionParticipantEvidence";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  customRatePct,
  fetchCustomTitleCellParticipants,
  fetchCustomTitlePhotoDatesSetForRange,
  fetchLeaderboardCustomTitleExpandForRange,
  fetchLeaderboardTemplateItemExpandForRange,
  fetchTemplateItemCellParticipants,
  fetchTemplateItemPhotoDatesSetForRange,
  templateRatePct,
  type CellParticipant,
  type CustomTitleStatRow,
  type TemplateItemStatRow,
} from "@/lib/supabase/leaderboardActionHeatmap";
import type { ActionCompletionPeriod } from "@/lib/utils/leaderboard";
import {
  actionCompletionScopeLabel,
  getActionCompletionDateBounds,
} from "@/lib/utils/leaderboardPeriod";
import {
  resolveHeatmapLayoutForActionCompletion,
  resolveHeatmapLayoutForDateRange,
  type HeatmapLayout,
} from "@/lib/utils/heatmapLayout";
import { eachDateStringInRange, getTodayString } from "@/lib/utils/date";
import { DateRangePickerPanel } from "@/components/ui/DateRangePickerPanel";
import { SdgFilterBar } from "@/components/ui/SdgFilterBar";
import { SdgTagStrip } from "@/components/ui/SdgTagStrip";
import { Calendar, Camera, ChevronDown, X } from "lucide-react";
import {
  cloneExpandDensity,
  expandDensityCacheKey,
  snapshotExpandDensity,
  type ExpandDensitySnapshot,
} from "@/lib/utils/actionCompletionExpandCache";
import { mapWithConcurrency } from "@/lib/utils/mapWithConcurrency";
import { rowMatchesSdgFilter } from "@/lib/utils/sdgFilter";
import { getISODay, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/constants/config";
import { useGlobalActionCompletionStats } from "@/hooks/useGlobalActionCompletionStats";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ROW_PHOTO_RPC_CONCURRENCY = 8;

const ACTION_COMPLETION_PERIODS: {
  id: ActionCompletionPeriod;
  label: string;
}[] = [
  { id: "today", label: "今日" },
  { id: "week", label: "本週" },
  { id: "month", label: "本月" },
];

const HEAT_BG = [
  "bg-[var(--color-muted)]/25",
  "bg-[var(--color-primary-strong)]/22",
  "bg-[var(--color-primary-strong)]/40",
  "bg-[var(--color-primary-strong)]/58",
  "bg-[var(--color-primary-strong)]",
] as const;

function densityLevel(n: number, max: number): number {
  if (n <= 0) return 0;
  if (max <= 0) return 1;
  const r = n / max;
  if (r >= 0.85) return 4;
  if (r >= 0.55) return 3;
  if (r >= 0.25) return 2;
  return 1;
}

type RowKey =
  | { kind: "template"; itemId: string }
  | { kind: "custom"; title: string };

const MAX_CUSTOM_RANGE_DAYS = 366;

function keyString(k: RowKey): string {
  return k.kind === "template" ? `t:${k.itemId}` : `c:${k.title}`;
}

function ActionDensityHeatmap({
  layout,
  byDate,
  todayStr,
  onCellClick,
  photoMarkDates,
}: {
  layout: HeatmapLayout;
  byDate: Map<string, number>;
  todayStr: string;
  onCellClick: (date: string) => void;
  /** 自訂行動：該日有佐證圖之日期（顯示角標） */
  photoMarkDates?: Set<string>;
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const v of byDate.values()) if (v > m) m = v;
    return m > 0 ? m : 1;
  }, [byDate]);

  /** 自訂長區間 GitHub 欄：偏好略小於舊版 12px；桌機寬度不足時縮格免橫向捲動，手機固定偏好尺寸可捲動 */
  const githubWrapRef = useRef<HTMLDivElement>(null);
  const [githubCellPx, setGithubCellPx] = useState(10);
  const isGithubLayout =
    layout.kind !== "week_cards" && layout.kind !== "month";
  const githubN = layout.kind === "github" ? layout.weekCols.length : 0;

  useLayoutEffect(() => {
    if (!isGithubLayout || githubN === 0) return;
    const el = githubWrapRef.current;
    if (!el) return;
    const PREFERRED = 10;
    const MIN = 7;
    const SIDEBAR = 20;
    const GAP = 1;

    const apply = () => {
      const node = githubWrapRef.current;
      if (!node) return;
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      const avail = node.clientWidth;
      if (avail < 24) return;
      if (!desktop) {
        setGithubCellPx(PREFERRED);
        return;
      }
      const natural = SIDEBAR + githubN * PREFERRED + githubN * GAP;
      if (natural <= avail) {
        setGithubCellPx(PREFERRED);
        return;
      }
      const raw = (avail - SIDEBAR - githubN * GAP) / githubN;
      const next = Math.max(MIN, Math.min(PREFERRED, Math.floor(raw)));
      setGithubCellPx(Number.isFinite(next) && next > 0 ? next : PREFERRED);
    };

    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(apply);
      });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", run);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", run);
    };
  }, [isGithubLayout, githubN]);

  const cell = (date: string | null) => {
    if (!date) {
      return (
        <div
          className="aspect-square min-h-0 w-full min-w-0 rounded-[2px] bg-transparent"
          aria-hidden
        />
      );
    }
    const future = date > todayStr;
    const n = future ? 0 : (byDate.get(date) ?? 0);
    const lv = densityLevel(n, max);
    const bg = HEAT_BG[lv] ?? HEAT_BG[0];
    const md = formatInTimeZone(parseISO(`${date}T12:00:00`), TIMEZONE, "M/d");
    const hasPhoto = photoMarkDates?.has(date) && !future && n > 0;
    const titleHint = hasPhoto ? "含佐證圖 · " : "";
    return (
      <button
        type="button"
        disabled={future || n <= 0}
        title={
          future
            ? `${md} · 尚未到達`
            : `${md} · ${titleHint}${n} 人次${n > 0 ? "（點擊看名單）" : ""}`
        }
        onClick={() => {
          if (!future && n > 0) onCellClick(date);
        }}
        className={[
          "relative aspect-square w-full min-h-0 min-w-0 rounded-[2px] border border-[var(--color-muted)]/20 transition",
          bg,
          future || n <= 0
            ? "cursor-default opacity-50"
            : "cursor-pointer hover:ring-2 hover:ring-[var(--color-primary)]/40",
        ].join(" ")}
      >
        {hasPhoto ? (
          <Camera
            className="pointer-events-none absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-[var(--color-ink)] drop-shadow-[0_0_3px_rgba(255,255,255,0.95)]"
            strokeWidth={2.75}
            aria-hidden
          />
        ) : null}
      </button>
    );
  };

  if (layout.kind === "week_cards") {
    return (
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {layout.days.map((d) => (
          <div
            key={d}
            className="flex w-10 shrink-0 flex-col items-center gap-1"
          >
            <span className="text-[9px] text-[var(--color-subtle)]">
              {
                ["一", "二", "三", "四", "五", "六", "日"][
                  getISODay(parseISO(`${d}T12:00:00`)) - 1
                ]
              }
            </span>
            <div className="w-full">{cell(d)}</div>
          </div>
        ))}
      </div>
    );
  }

  if (layout.kind === "month") {
    const mc = 34;
    return (
      <div className="mt-2 w-full min-w-0 overflow-x-auto pb-0.5">
        <div className="mx-auto w-max">
          <div
            className="mb-1 grid gap-px text-center text-[9px] text-[var(--color-subtle)]"
            style={{ gridTemplateColumns: `repeat(7, ${mc}px)` }}
          >
            {["一", "二", "三", "四", "五", "六", "日"].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(7, ${mc}px)` }}
          >
            {layout.cells.map((d, i) => (
              <div key={d ?? `e-${i}`} className="min-w-0">
                {d ? (
                  <div
                    className="shrink-0 [&>button]:h-full [&>button]:w-full [&>button]:min-h-0 [&>button]:min-w-0 [&>button]:rounded-[2px] [&>button]:p-0"
                    style={{ width: mc, height: mc }}
                  >
                    {cell(d)}
                  </div>
                ) : (
                  <div
                    className="shrink-0 rounded-[2px] bg-transparent"
                    style={{ width: mc, height: mc }}
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { weekCols, monthLabels } = layout;
  const n = weekCols.length;
  const ghPx =
    Number.isFinite(githubCellPx) && githubCellPx > 0
      ? Math.min(14, Math.max(5, githubCellPx))
      : 10;
  const weekdayRows = ["一", "", "三", "", "五", "", "日"] as const;
  const templateCols =
    n === 0 ? "1.25rem" : (`1.25rem repeat(${n}, ${ghPx}px)` as const);
  const ghGridWidth =
    n > 0 ? `calc(1.25rem + ${n} * ${ghPx}px + ${n}px)` : undefined;

  const bodyCells = Array.from({ length: 7 }, (_, dayIdx) => {
    const left = (
      <div
        key={`w-${dayIdx}`}
        className="flex min-h-0 items-center justify-end py-0.5 pr-1 text-[9px] text-[var(--color-subtle)]"
        style={{ gridColumn: 1, gridRow: dayIdx + 2 }}
      >
        {weekdayRows[dayIdx]}
      </div>
    );
    const cells = weekCols.map((col, wi) => {
      const date = col[dayIdx] ?? null;
      return (
        <div
          key={`c-${wi}-${dayIdx}`}
          className="flex min-h-0 min-w-0 items-center justify-center"
          style={{ gridColumn: wi + 2, gridRow: dayIdx + 2 }}
        >
          {date ? (
            <div
              className="shrink-0 [&>button]:h-full [&>button]:w-full [&>button]:min-h-0 [&>button]:min-w-0 [&>button]:rounded-[2px] [&>button]:p-0"
              style={{ width: ghPx, height: ghPx }}
            >
              {cell(date)}
            </div>
          ) : (
            <div
              className="shrink-0 rounded-[2px] border border-[var(--color-muted)]/15 bg-[var(--color-muted)]/10"
              style={{ width: ghPx, height: ghPx }}
              aria-hidden
            />
          )}
        </div>
      );
    });
    return [left, ...cells];
  }).flat();

  return (
    <div
      ref={githubWrapRef}
      className="mt-2 w-full min-w-0 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] touch-pan-x"
    >
      <div
        className="grid w-max gap-px pb-1"
        style={{
          gridTemplateColumns: templateCols,
          gridTemplateRows: `auto repeat(7, ${ghPx}px)`,
          ...(ghGridWidth ? { width: ghGridWidth } : {}),
        }}
      >
        <div style={{ gridColumn: 1, gridRow: 1 }} aria-hidden />
        {monthLabels.map((lab, wi) => (
          <div
            key={`m-${wi}`}
            className="relative min-h-[18px] min-w-0"
            style={{ gridColumn: wi + 2, gridRow: 1 }}
          >
            {lab ? (
              <span className="absolute bottom-0 left-0 z-10 whitespace-nowrap text-[8px] leading-none text-[var(--color-subtle)]">
                {lab}
              </span>
            ) : null}
          </div>
        ))}
        {bodyCells}
      </div>
    </div>
  );
}

export function GlobalActionCompletionSection() {
  const todayStr = getTodayString();
  const [rangeMode, setRangeMode] = useState<"preset" | "custom">("preset");
  const [actionPeriod, setActionPeriod] =
    useState<ActionCompletionPeriod>("week");
  const [customStart, setCustomStart] = useState(
    () => getActionCompletionDateBounds("week").start,
  );
  const [customEnd, setCustomEnd] = useState(
    () => getActionCompletionDateBounds("week").end,
  );
  const [pickerStart, setPickerStart] = useState(
    () => getActionCompletionDateBounds("week").start,
  );
  const [pickerEnd, setPickerEnd] = useState(
    () => getActionCompletionDateBounds("week").end,
  );
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [sdgFilter, setSdgFilter] = useState<Set<number>>(() => new Set());
  const periodBarRef = useRef<HTMLDivElement>(null);
  const [rangePanelOpen, setRangePanelOpen] = useState(false);

  const effectiveBounds = useMemo(() => {
    if (rangeMode === "preset") {
      return getActionCompletionDateBounds(actionPeriod);
    }
    return { start: customStart, end: customEnd };
  }, [rangeMode, actionPeriod, customStart, customEnd]);

  const chartStart = effectiveBounds.start;
  const chartEnd = effectiveBounds.end;

  const pl =
    rangeMode === "custom"
      ? "自訂區間"
      : actionCompletionScopeLabel(actionPeriod);

  const layout = useMemo(() => {
    if (rangeMode === "custom") {
      return resolveHeatmapLayoutForDateRange(chartStart, chartEnd);
    }
    return resolveHeatmapLayoutForActionCompletion(actionPeriod, chartEnd);
  }, [rangeMode, actionPeriod, chartStart, chartEnd]);

  const {
    templateRows,
    customRows,
    loadingList,
    listError,
    listSilentEpoch,
  } = useGlobalActionCompletionStats(effectiveBounds);

  const [expanded, setExpanded] = useState<RowKey | null>(null);
  useEffect(() => {
    setExpanded(null);
  }, [chartStart, chartEnd]);

  useEffect(() => {
    setExpanded(null);
  }, [sdgFilter]);

  const templateRowsFiltered = useMemo(
    () =>
      templateRows.filter((r) =>
        rowMatchesSdgFilter(r.sdgIds, sdgFilter),
      ),
    [templateRows, sdgFilter],
  );

  const customRowsFiltered = useMemo(
    () =>
      customRows.filter((r) =>
        rowMatchesSdgFilter(r.sdgIds, sdgFilter),
      ),
    [customRows, sdgFilter],
  );

  const completionRowsRef = useRef({
    templateRowsFiltered,
    customRowsFiltered,
  });
  completionRowsRef.current = {
    templateRowsFiltered,
    customRowsFiltered,
  };

  const [densityMap, setDensityMap] = useState<Map<string, number>>(new Map());
  const [photoMarkDates, setPhotoMarkDates] = useState<Set<string>>(
    () => new Set(),
  );
  const [densityLoading, setDensityLoading] = useState(false);
  const [rowPhotoFlags, setRowPhotoFlags] = useState<Map<string, boolean>>(
    () => new Map(),
  );

  const [modal, setModal] = useState<{
    date: string;
    key: RowKey;
    participants: CellParticipant[];
    loading: boolean;
  } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [photoTab, setPhotoTab] = useState<"list" | "gallery">("list");

  const expandDensityCacheRef = useRef<Map<string, ExpandDensitySnapshot>>(
    new Map(),
  );

  useEffect(() => {
    expandDensityCacheRef.current.clear();
  }, [chartStart, chartEnd]);

  useEffect(() => {
    if (!rangePanelOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!periodBarRef.current?.contains(e.target as Node)) {
        setRangePanelOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRangePanelOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [rangePanelOpen]);

  useEffect(() => {
    if (!expanded) {
      setDensityMap(new Map());
      setPhotoMarkDates(new Set());
      setDensityLoading(false);
      return;
    }
    const { start, end } = effectiveBounds;
    const cacheKey = expandDensityCacheKey({
      rowKeyStr: keyString(expanded),
      start,
      end,
      listSilentEpoch,
    });
    const cached = expandDensityCacheRef.current.get(cacheKey);
    if (cached) {
      const snap = cloneExpandDensity(cached);
      setDensityMap(snap.densityMap);
      setPhotoMarkDates(snap.photoMarkDates);
      setDensityLoading(false);
      return;
    }
    let cancelled = false;
    setDensityLoading(true);
    void (async () => {
      try {
        if (expanded.kind === "template") {
          const { densityMap: m, photoDates: photoSet } =
            await fetchLeaderboardTemplateItemExpandForRange(
              start,
              end,
              expanded.itemId,
            );
          if (!cancelled) {
            setDensityMap(m);
            setPhotoMarkDates(photoSet);
            expandDensityCacheRef.current.set(
              cacheKey,
              snapshotExpandDensity(m, photoSet),
            );
          }
        } else {
          const { densityMap: m, photoDates: photoSet } =
            await fetchLeaderboardCustomTitleExpandForRange(
              start,
              end,
              expanded.title,
            );
          if (!cancelled) {
            setDensityMap(m);
            setPhotoMarkDates(photoSet);
            expandDensityCacheRef.current.set(
              cacheKey,
              snapshotExpandDensity(m, photoSet),
            );
          }
        }
      } catch {
        if (!cancelled) {
          setDensityMap(new Map());
          setPhotoMarkDates(new Set());
        }
      } finally {
        if (!cancelled) setDensityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, effectiveBounds, listSilentEpoch]);

  const openCell = useCallback(async (date: string, key: RowKey) => {
    setModal({ date, key, participants: [], loading: true });
    setPhotoTab("list");
    try {
      const rows =
        key.kind === "template"
          ? await fetchTemplateItemCellParticipants(date, key.itemId)
          : await fetchCustomTitleCellParticipants(date, key.title);
      setModal({ date, key, participants: rows, loading: false });
    } catch {
      setModal({ date, key, participants: [], loading: false });
    }
  }, []);

  const rankedTemplate = useMemo(() => {
    const sorted = [...templateRowsFiltered].sort((a, b) => {
      const ra = templateRatePct(a);
      const rb = templateRatePct(b);
      if (rb !== ra) return rb - ra;
      return a.sortOrder - b.sortOrder;
    });
    return sorted;
  }, [templateRowsFiltered]);

  const rankedCustom = useMemo(() => {
    return [...customRowsFiltered].sort(
      (a, b) => customRatePct(b) - customRatePct(a),
    );
  }, [customRowsFiltered]);

  const rowPhotoSig = useMemo(
    () =>
      JSON.stringify({
        s: chartStart,
        e: chartEnd,
        t: templateRowsFiltered.map((r) => r.itemId),
        c: customRowsFiltered.map((r) => r.title),
        rt: listSilentEpoch,
      }),
    [
      chartStart,
      chartEnd,
      templateRowsFiltered,
      customRowsFiltered,
      listSilentEpoch,
    ],
  );

  useEffect(() => {
    if (loadingList) return;
    let cancelled = false;
    const { start, end } = effectiveBounds;
    const { templateRowsFiltered: tr, customRowsFiltered: cr } =
      completionRowsRef.current;
    void (async () => {
      const next = new Map<string, boolean>();
      const tmpl = await mapWithConcurrency(
        tr,
        ROW_PHOTO_RPC_CONCURRENCY,
        async (r) => {
          const k = `t:${r.itemId}`;
          try {
            const s = await fetchTemplateItemPhotoDatesSetForRange(
              start,
              end,
              r.itemId,
            );
            return { k, ok: s.size > 0 };
          } catch {
            return { k, ok: false };
          }
        },
      );
      if (cancelled) return;
      for (const { k, ok } of tmpl) next.set(k, ok);
      const cust = await mapWithConcurrency(
        cr,
        ROW_PHOTO_RPC_CONCURRENCY,
        async (r) => {
          const k = `c:${r.title}`;
          try {
            const s = await fetchCustomTitlePhotoDatesSetForRange(
              start,
              end,
              r.title,
            );
            return { k, ok: s.size > 0 };
          } catch {
            return { k, ok: false };
          }
        },
      );
      if (cancelled) return;
      for (const { k, ok } of cust) next.set(k, ok);
      setRowPhotoFlags(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadingList, effectiveBounds, rowPhotoSig]);

  function applyPickerRange(): boolean {
    let s = pickerStart;
    let e = pickerEnd;
    if (!s || !e) {
      setRangeError("請選擇開始與結束日期");
      return false;
    }
    if (s > e) [s, e] = [e, s];
    if (e > todayStr) e = todayStr;
    if (s > todayStr) s = todayStr;
    const days = eachDateStringInRange(s, e).length;
    if (days <= 0) {
      setRangeError("請選擇有效日期");
      return false;
    }
    if (days > MAX_CUSTOM_RANGE_DAYS) {
      setRangeError(`區間最長 ${MAX_CUSTOM_RANGE_DAYS} 天`);
      return false;
    }
    setRangeError(null);
    setCustomStart(s);
    setCustomEnd(e);
    setRangeMode("custom");
    return true;
  }

  function renderRow(
    rank: number,
    title: string,
    ratePct: number,
    subline: string,
    denomLine: string,
    rowKey: RowKey,
    maxRate: number,
    sdgIds: number[],
  ) {
    const open = expanded && keyString(expanded) === keyString(rowKey);
    const barPct =
      maxRate > 0 ? Math.min(100, Math.round((ratePct / maxRate) * 100)) : 0;
    const rowHasPhoto = rowPhotoFlags.get(keyString(rowKey)) === true;
    return (
      <div
        key={keyString(rowKey)}
        className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-white)] shadow-sm"
      >
        <button
          type="button"
          onClick={() => setExpanded(open ? null : rowKey)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left sm:gap-3"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-xs font-bold text-[var(--color-primary-dark)]">
            {rank}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-ink)]">
            {title}
          </span>
          <div className="hidden w-28 shrink-0 sm:block">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary-strong)] to-[var(--color-primary)]"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-primary-dark)]">
            {ratePct.toFixed(1)}%
          </span>
          {rowHasPhoto ? (
            <Camera
              className="h-4 w-4 shrink-0 text-[var(--color-ink-secondary)]"
              strokeWidth={2}
              aria-label="此區間有佐證照片"
            />
          ) : null}
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-[var(--color-subtle)] transition",
              open ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden
          />
        </button>
        <p className="px-3 pb-2 text-[11px] leading-snug text-[var(--color-ink-secondary)]">
          {subline}
          {rowHasPhoto ? (
            <span className="ml-1 inline-flex items-center gap-0.5 text-[var(--color-subtle)]">
              <Camera
                className="inline h-3 w-3"
                strokeWidth={2}
                aria-hidden
              />
              含佐證
            </span>
          ) : null}
        </p>
        <p className="px-3 pb-2 text-[10px] text-[var(--color-subtle)]">
          {denomLine}
        </p>
        <SdgTagStrip ids={sdgIds} />
        {open ? (
          <div className="border-t border-[var(--color-muted)]/40 px-2 pb-3 pt-2">
            <p className="mb-1 text-[10px] leading-snug text-[var(--color-subtle)]">
              與卡片上方所選「{pl}」區間一致；色越深表示該日完成人次越高。該日至少一筆打卡含佐證圖時，格內右下角顯示相機圖示。
            </p>
            {densityLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : (
              <ActionDensityHeatmap
                layout={layout}
                byDate={densityMap}
                todayStr={todayStr}
                onCellClick={(d) => void openCell(d, rowKey)}
                photoMarkDates={photoMarkDates}
              />
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const maxTemplateRate =
    rankedTemplate.length > 0
      ? Math.max(...rankedTemplate.map(templateRatePct), 1)
      : 1;
  const maxCustomRate =
    rankedCustom.length > 0
      ? Math.max(...rankedCustom.map(customRatePct), 1)
      : 1;

  if (loadingList) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }
  if (listError) {
    return (
      <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
        行動完成率載入失敗：{listError}（請套用 migration
        `20260322123000_leaderboard_action_density_rpcs.sql`、
        `20260322141000_custom_title_stats_list_days.sql`、
        `20260322142000_custom_title_stats_include_list_only.sql`、
        `20260322150000_action_completion_sdg_ids.sql`）
      </p>
    );
  }

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          各項完成率（點開看密度圖）
        </h3>
        <div
          ref={periodBarRef}
          className="relative w-full min-w-0 sm:ml-auto sm:w-auto"
        >
          <div className="flex w-full justify-end">
            <div
              className="grid w-full max-w-none grid-cols-4 gap-1 rounded-full border border-[var(--color-muted)]/60 bg-[var(--color-white)]/70 p-1 shadow-sm sm:w-[17.5rem]"
              role="group"
              aria-label="各項完成率統計區間"
            >
              {ACTION_COMPLETION_PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setRangeMode("preset");
                    setActionPeriod(p.id);
                    setRangePanelOpen(false);
                  }}
                  className={[
                    "flex min-h-[2.35rem] min-w-0 items-center justify-center rounded-full px-1 py-1 text-center text-[11px] font-medium leading-tight transition sm:text-xs",
                    rangeMode === "preset" && actionPeriod === p.id
                      ? "bg-[var(--color-primary-strong)] text-[var(--color-white)] shadow-sm"
                      : "text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)]/50",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (rangePanelOpen) {
                    setRangePanelOpen(false);
                  } else {
                    setPickerStart(chartStart);
                    setPickerEnd(chartEnd);
                    setRangeError(null);
                    setRangePanelOpen(true);
                  }
                }}
                className={[
                  "flex min-h-[2.35rem] min-w-0 flex-row items-center justify-center gap-0.5 rounded-full px-0.5 py-0.5 text-center font-medium transition",
                  rangeMode === "custom"
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] shadow-sm"
                    : rangePanelOpen
                      ? "bg-[var(--color-primary-pale)]/80 text-[var(--color-primary-dark)]"
                      : "text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)]/50",
                ].join(" ")}
                aria-expanded={rangePanelOpen}
                aria-haspopup="dialog"
                aria-label="自訂日期區間"
              >
                <Calendar className="h-3 w-3 shrink-0 opacity-85" aria-hidden />
                <span className="text-[10px] leading-none sm:text-[11px]">
                  自訂
                </span>
                <ChevronDown
                  className={[
                    "h-2.5 w-2.5 shrink-0 text-[var(--color-subtle)] transition",
                    rangePanelOpen ? "rotate-180" : "",
                  ].join(" ")}
                  aria-hidden
                />
              </button>
            </div>
          </div>
          {rangePanelOpen ? (
            <div className="absolute left-1/2 top-[calc(100%+0.35rem)] z-[80] w-[min(calc(100vw-1.25rem),30rem)] -translate-x-1/2 overflow-x-hidden overflow-y-auto max-sm:max-h-[min(75vh,34rem)] rounded-2xl border border-[var(--color-muted)]/50 bg-[var(--color-white)] p-4 shadow-xl sm:left-auto sm:right-0 sm:translate-x-0 sm:max-h-none sm:min-w-[22rem] sm:overflow-y-visible sm:w-[28rem]">
              <DateRangePickerPanel
                maxDate={todayStr}
                start={pickerStart}
                end={pickerEnd}
                onRangeChange={(s, e) => {
                  setPickerStart(s);
                  setPickerEnd(e);
                  setRangeError(null);
                }}
                onClear={() => {
                  const w = getActionCompletionDateBounds("week");
                  setPickerStart(w.start);
                  setPickerEnd(w.end);
                  setRangeError(null);
                }}
              />
              {rangeError ? (
                <p className="mb-2 text-xs text-amber-800">{rangeError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (applyPickerRange()) setRangePanelOpen(false);
                }}
                className="mt-1 w-full rounded-full bg-[var(--color-primary-strong)] px-4 py-2.5 text-xs font-semibold text-[var(--color-white)] shadow-sm transition hover:opacity-95 active:scale-[0.99]"
              >
                套用此區間
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--color-subtle)]">
        （{chartStart === chartEnd ? chartStart : `${chartStart}～${chartEnd}`}
        ）。公版：完成率＝打卡人次 ÷（區間天數 × 期間內曾打卡人數）×
        100%。自訂：完成率＝打卡次數 ÷ 列入今日清單人日數（依標題彙總）× 100%。
      </p>
      <div className="mt-3">
        <SdgFilterBar selected={sdgFilter} onChange={setSdgFilter} />
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
          公版項目
        </p>
        {rankedTemplate.length === 0 ? (
          <p className="text-sm text-[var(--color-subtle)]">
            尚無公版項目資料。
          </p>
        ) : (
          rankedTemplate.map((r, i) =>
            renderRow(
              i + 1,
              r.title,
              templateRatePct(r),
              `${r.checkinCount} 次打卡 · ${r.achieverCount} 人曾完成`,
              `分母＝${r.periodDays} 天 × ${r.activeUsers} 人（期間內曾打卡者）`,
              { kind: "template", itemId: r.itemId },
              maxTemplateRate,
              r.sdgIds ?? [],
            ),
          )
        )}
      </div>
      {rankedCustom.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-[var(--color-ink-secondary)]">
            自訂行動（依標題彙總）
          </p>
          {rankedCustom.map((r, i) =>
            renderRow(
              rankedTemplate.length + i + 1,
              r.title,
              customRatePct(r),
              `${r.checkinCount} 次打卡 · ${r.achieverCount} 人曾完成`,
              r.legacyListDenominator
                ? `分母估算＝${r.onListDays}（區間天數×曾打卡人數；資料庫請套用 migration \`20260322141000_custom_title_stats_list_days.sql\` 改為「列入今日清單」人日）。完成 ${r.checkinCount} 次。`
                : `分母＝列入今日清單 ${r.onListDays} 人日；完成 ${r.checkinCount} 次。`,
              { kind: "custom", title: r.title },
              maxCustomRate,
              r.sdgIds ?? [],
            ),
          )}
        </div>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[900] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="完成者名單"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-muted)]/60 px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {modal.date} 完成者
              </p>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-2 border-b border-[var(--color-muted)]/40 px-4 py-2">
              <button
                type="button"
                onClick={() => setPhotoTab("list")}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  photoTab === "list"
                    ? "bg-[var(--color-primary-strong)] text-white"
                    : "text-[var(--color-ink-secondary)]",
                ].join(" ")}
              >
                清單
              </button>
              <button
                type="button"
                onClick={() => setPhotoTab("gallery")}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  photoTab === "gallery"
                    ? "bg-[var(--color-primary-strong)] text-white"
                    : "text-[var(--color-ink-secondary)]",
                ].join(" ")}
              >
                照片牆
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-4">
              <ActionCompletionParticipantEvidence
                participants={modal.participants}
                photoTab={photoTab}
                loading={modal.loading}
                onOpenLightbox={setLightbox}
              />
            </div>
          </div>
        </div>
      ) : null}

      {lightbox ? (
        <ImageLightbox src={lightbox} open onClose={() => setLightbox(null)} />
      ) : null}
    </div>
  );
}
