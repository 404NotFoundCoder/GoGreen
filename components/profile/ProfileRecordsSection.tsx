"use client";

import { TodayChecklist } from "@/components/checklist/TodayChecklist";
import { ActionCompletionParticipantEvidence } from "@/components/leaderboard/ActionCompletionParticipantEvidence";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  customRatePct,
  fetchCustomTitleCellParticipants,
  fetchProfileCustomTitleExpandForRange,
  fetchProfileCustomTitlePhotoDatesSetForRange,
  fetchProfileTemplateItemExpandForRange,
  fetchProfileTemplateItemPhotoDatesSetForRange,
  fetchTemplateItemCellParticipants,
  templateRatePct,
  type CellParticipant,
  type CustomTitleStatRow,
  type TemplateItemStatRow,
} from "@/lib/supabase/leaderboardActionHeatmap";
import {
  clearUserCalendarDay,
  fetchUserDayActivityExtrasInRange,
} from "@/lib/supabase/checklist";
import { fetchUserDayNote, upsertUserDayNote } from "@/lib/supabase/dayNote";
import { fetchUserDailyStatsInRange } from "@/lib/supabase/stats";
import type { DailyStatRow } from "@/lib/supabase/stats";
import { useAuthContext } from "@/context/AuthContext";
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
import {
  cloneExpandDensity,
  expandDensityCacheKey,
  snapshotExpandDensity,
  type ExpandDensitySnapshot,
} from "@/lib/utils/actionCompletionExpandCache";
import { eachDateStringInRange, getTodayString } from "@/lib/utils/date";
import { mapWithConcurrency } from "@/lib/utils/mapWithConcurrency";
import { rowMatchesSdgFilter } from "@/lib/utils/sdgFilter";
import { DateRangePickerPanel } from "@/components/ui/DateRangePickerPanel";
import { SdgFilterBar } from "@/components/ui/SdgFilterBar";
import { SdgTagStrip } from "@/components/ui/SdgTagStrip";
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Leaf,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { getISODay, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/constants/config";
import { useProfileActionCompletionStats } from "@/hooks/useProfileActionCompletionStats";
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

/** 個人密度：有打卡＝深綠、無＝白 */
const BINARY_YES = "bg-[#849B6D] border-[#6d8059]/40";
const BINARY_NO = "bg-[var(--color-white)] border-[var(--color-muted)]/35";

type RowKey =
  | { kind: "template"; itemId: string }
  | { kind: "custom"; title: string };

const MAX_CUSTOM_RANGE_DAYS = 366;

function keyString(k: RowKey): string {
  return k.kind === "template" ? `t:${k.itemId}` : `c:${k.title}`;
}

export function ProfileBinaryDensityHeatmap({
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
  /** 該日打卡含佐證圖時顯示角標（與全體榜一致） */
  photoMarkDates?: Set<string>;
}) {
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
    const has = n > 0;
    const md = formatInTimeZone(parseISO(`${date}T12:00:00`), TIMEZONE, "M/d");
    const surface = future
      ? "border-[var(--color-muted)]/20 bg-[var(--color-muted)]/10 opacity-50"
      : has
        ? BINARY_YES
        : BINARY_NO;
    const hasPhoto = Boolean(photoMarkDates?.has(date) && !future && has);
    const photoHint = hasPhoto ? "含佐證圖 · " : "";
    return (
      <button
        type="button"
        disabled={future || !has}
        title={
          future
            ? `${md} · 尚未到達`
            : has
              ? `${md} · ${photoHint}有打卡（點擊看紀錄）`
              : `${md} · 無打卡`
        }
        onClick={() => {
          if (!future && has) onCellClick(date);
        }}
        className={[
          "relative aspect-square block h-full min-h-0 w-full min-w-0 appearance-none rounded-[2px] border p-0 transition",
          surface,
          future || !has
            ? "cursor-default"
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
      <div className="mt-2 flex gap-1.5 overflow-x-auto overflow-y-visible pb-1">
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
      <div className="mt-2 w-full min-w-0 overflow-x-auto overflow-y-visible pb-0.5">
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
      className="mt-2 w-full min-w-0 overflow-x-auto overflow-y-visible pb-0.5 [-webkit-overflow-scrolling:touch] touch-pan-x"
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

export function ProfileRecordsSection() {
  const todayStr = getTodayString();
  const [mainTab, setMainTab] = useState<"completion" | "weekly">("completion");
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

  const { user } = useAuthContext();
  const {
    templateRows,
    customRows,
    loadingList,
    listError,
    listSilentEpoch,
  } = useProfileActionCompletionStats(effectiveBounds);

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

  const [weeklyRows, setWeeklyRows] = useState<DailyStatRow[]>([]);
  const [weeklyExtras, setWeeklyExtras] = useState<
    Map<string, { customTotal: number; customDone: number; hasPhoto: boolean }>
  >(() => new Map());
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [dayDialog, setDayDialog] = useState<{
    date: string;
    mode: "view" | "edit";
  } | null>(null);
  const [addDateOpen, setAddDateOpen] = useState(false);
  const [addDatePick, setAddDatePick] = useState("");
  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [dlgDayNote, setDlgDayNote] = useState("");
  const [dlgDayNoteLoading, setDlgDayNoteLoading] = useState(false);
  const [dlgDayNoteSaving, setDlgDayNoteSaving] = useState(false);

  const refetchWeekly = useCallback(async () => {
    if (!user?.id) return;
    setWeeklyLoading(true);
    setWeeklyError(null);
    try {
      const [stats, extras] = await Promise.all([
        fetchUserDailyStatsInRange(user.id, chartStart, chartEnd),
        fetchUserDayActivityExtrasInRange(user.id, chartStart, chartEnd),
      ]);
      setWeeklyRows([...stats].reverse());
      setWeeklyExtras(extras);
    } catch (e) {
      setWeeklyError(e instanceof Error ? e.message : String(e));
    } finally {
      setWeeklyLoading(false);
    }
  }, [user?.id, chartStart, chartEnd]);

  useEffect(() => {
    if (!user?.id) return;
    void refetchWeekly();
  }, [user?.id, refetchWeekly]);

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
          const { densityMap: m, photoDates: photos } =
            await fetchProfileTemplateItemExpandForRange(
              start,
              end,
              expanded.itemId,
            );
          if (!cancelled) {
            setDensityMap(m);
            setPhotoMarkDates(photos);
            expandDensityCacheRef.current.set(
              cacheKey,
              snapshotExpandDensity(m, photos),
            );
          }
        } else {
          const { densityMap: m, photoDates: photos } =
            await fetchProfileCustomTitleExpandForRange(
              start,
              end,
              expanded.title,
            );
          if (!cancelled) {
            setDensityMap(m);
            setPhotoMarkDates(photos);
            expandDensityCacheRef.current.set(
              cacheKey,
              snapshotExpandDensity(m, photos),
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

  const openCell = useCallback(
    async (date: string, key: RowKey) => {
      setModal({ date, key, participants: [], loading: true });
      setPhotoTab("list");
      try {
        const rows =
          key.kind === "template"
            ? await fetchTemplateItemCellParticipants(date, key.itemId)
            : await fetchCustomTitleCellParticipants(date, key.title);
        const uid = user?.id;
        const mine = uid ? rows.filter((p) => p.userId === uid) : rows;
        setModal({ date, key, participants: mine, loading: false });
      } catch {
        setModal({ date, key, participants: [], loading: false });
      }
    },
    [user?.id],
  );

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
    if (mainTab !== "completion" || loadingList) return;
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
            const s = await fetchProfileTemplateItemPhotoDatesSetForRange(
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
            const s = await fetchProfileCustomTitlePhotoDatesSetForRange(
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
  }, [mainTab, loadingList, effectiveBounds, rowPhotoSig]);

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
          <div className="border-t border-[var(--color-muted)]/40 overflow-x-auto overflow-y-visible overscroll-x-contain px-2 pb-3 pt-2">
            <p className="mb-1 text-[10px] leading-snug text-[var(--color-subtle)]">
              與上方所選「{pl}」區間一致；有打卡為綠底，無打卡為白底。有佐證照片之日在格內右下角顯示相機圖示。
            </p>
            {densityLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : (
              <ProfileBinaryDensityHeatmap
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

  const weeklyRowsWithCheckin = useMemo(
    () => weeklyRows.filter((r) => r.completed_count > 0),
    [weeklyRows],
  );

  const dayNavDates = useMemo(
    () => eachDateStringInRange(chartStart, chartEnd),
    [chartStart, chartEnd],
  );

  const closeDayDialog = useCallback(() => {
    setDayDialog(null);
    setDlgDayNote("");
    void refetchWeekly();
  }, [refetchWeekly]);

  useEffect(() => {
    if (!dayDialog || !user?.id) return;
    let cancelled = false;
    setDlgDayNote("");
    setDlgDayNoteLoading(true);
    void fetchUserDayNote(user.id, dayDialog.date)
      .then((n) => {
        if (!cancelled) setDlgDayNote(n);
      })
      .catch(() => {
        if (!cancelled) setDlgDayNote("");
      })
      .finally(() => {
        if (!cancelled) setDlgDayNoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayDialog?.date, user?.id]);

  const dayNavIdx =
    dayDialog != null ? dayNavDates.indexOf(dayDialog.date) : -1;
  const canDayPrev = dayNavIdx > 0;
  const canDayNext = dayNavIdx >= 0 && dayNavIdx < dayNavDates.length - 1;

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="mb-3 flex w-full flex-wrap items-center justify-center gap-2">
        <div
          className="inline-flex rounded-full border border-[var(--color-muted)]/60 bg-[var(--color-white)]/80 p-0.5 shadow-sm"
          role="tablist"
          aria-label="紀錄分頁"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "completion"}
            onClick={() => setMainTab("completion")}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              mainTab === "completion"
                ? "bg-[var(--color-primary-strong)] text-[var(--color-white)] shadow-sm"
                : "text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)]/50",
            ].join(" ")}
          >
            各項完成率
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "weekly"}
            onClick={() => setMainTab("weekly")}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              mainTab === "weekly"
                ? "bg-[var(--color-primary-strong)] text-[var(--color-white)] shadow-sm"
                : "text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)]/50",
            ].join(" ")}
          >
            每週紀錄
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddDatePick(chartEnd <= todayStr ? chartEnd : todayStr);
            setAddDateOpen(true);
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-muted)]/70 bg-[var(--color-white)] px-3 text-xs font-medium text-[var(--color-primary-dark)] shadow-sm transition hover:bg-[var(--color-primary-light)]/40"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          填寫紀錄
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          {mainTab === "completion" ? "各項完成率（點開看密度圖）" : "每週紀錄"}
        </h3>
        <div
          ref={periodBarRef}
          className="relative w-full min-w-0 sm:ml-auto sm:w-auto"
        >
          <div className="flex w-full justify-end">
            <div
              className="grid w-full max-w-none grid-cols-4 gap-1 rounded-full border border-[var(--color-muted)]/60 bg-[var(--color-white)]/70 p-1 shadow-sm sm:w-[17.5rem]"
              role="group"
              aria-label="紀錄統計區間"
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
      {mainTab === "completion" ? (
        <>
          {loadingList ? (
            <Skeleton className="mt-3 h-48 w-full rounded-xl" />
          ) : listError ? (
            <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
              行動完成率載入失敗：{listError}（請套用 migration
              `20260322200000_profile_action_completion_rpcs.sql` 及全體榜相關
              RPC）
            </p>
          ) : (
            <>
              <p className="mt-2 text-xs text-[var(--color-subtle)]">
                （
                {chartStart === chartEnd
                  ? chartStart
                  : `${chartStart}～${chartEnd}`}
                ）。公版：完成率＝本人打卡次數 ÷ 區間天數 ×
                100%。自訂：完成率＝打卡次數 ÷ 列入今日清單人日數（本人）×
                100%。
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
                      `${r.checkinCount} 次打卡（本人）`,
                      `分母＝區間 ${r.periodDays} 天`,
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
                      `${r.checkinCount} 次打卡（本人）`,
                      r.legacyListDenominator
                        ? `分母估算＝${r.onListDays}（請套用 migration 20260322141000）。`
                        : `分母＝列入今日清單 ${r.onListDays} 人日（本人）。`,
                      { kind: "custom", title: r.title },
                      maxCustomRate,
                      r.sdgIds ?? [],
                    ),
                  )}
                </div>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-[var(--color-subtle)]">
            區間與上方相同：「{pl}」（
            {chartStart === chartEnd
              ? chartStart
              : `${chartStart}～${chartEnd}`}
            ）。僅列有打卡紀錄之日；檢視為唯讀（無自訂／收藏區），編輯同「今日」版面。
          </p>
          {weeklyLoading ? (
            <Skeleton className="mt-3 h-48 w-full rounded-xl" />
          ) : weeklyError ? (
            <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
              無法載入每週紀錄：{weeklyError}
            </p>
          ) : weeklyRowsWithCheckin.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-secondary)]">
              此區間尚無打卡紀錄。可點上方「填寫紀錄」選擇日期並新增。
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-[0.5px] border-[var(--color-muted)] text-left text-[var(--color-ink-secondary)]">
                    <th className="py-2 pr-2 font-medium">日期</th>
                    <th className="py-2 pr-2 font-medium">進度</th>
                    <th className="py-2 pr-2 font-medium">自訂</th>
                    <th className="py-2 pr-2 font-medium">得分</th>
                    <th className="py-2 pr-2 font-medium">連續</th>
                    <th className="py-2 pr-2 font-medium text-center">照片</th>
                    <th className="py-2 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyRowsWithCheckin.map((r) => {
                    const ex = weeklyExtras.get(r.date);
                    const customTotal = ex?.customTotal ?? 0;
                    const customDone = Math.min(
                      ex?.customDone ?? 0,
                      customTotal || Infinity,
                    );
                    const full =
                      r.total_items > 0 && r.completed_count >= r.total_items;
                    return (
                      <tr
                        key={r.date}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer border-b-[0.5px] border-[var(--color-muted)]/60 transition hover:bg-[var(--color-primary-light)]/20"
                        onClick={() =>
                          setDayDialog({ date: r.date, mode: "view" })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDayDialog({ date: r.date, mode: "view" });
                          }
                        }}
                      >
                        <td className="py-2 pr-2 tabular-nums font-medium text-[var(--color-ink)]">
                          {r.date}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                          {r.completed_count}/{r.total_items}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                          {customTotal > 0
                            ? `${customDone}/${customTotal}`
                            : "—"}
                        </td>
                        <td className="py-2 pr-2">
                          <span className="inline-flex items-center gap-1 tabular-nums text-[var(--color-ink)]">
                            {r.raw_score}
                            {full ? (
                              <span title="當日清單全完成">
                                <Leaf
                                  className="h-4 w-4 shrink-0 text-emerald-600"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                          {r.streak} 天
                        </td>
                        <td className="py-2 pr-2 text-center">
                          {ex?.hasPhoto ? (
                            <Camera
                              className="mx-auto h-4 w-4 text-[var(--color-ink-secondary)]"
                              strokeWidth={2}
                              aria-label="有佐證照片"
                            />
                          ) : (
                            <span className="text-[var(--color-subtle)]">
                              —
                            </span>
                          )}
                        </td>
                        <td
                          className="py-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
                              aria-label="檢視"
                              onClick={() =>
                                setDayDialog({ date: r.date, mode: "view" })
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
                              aria-label="編輯"
                              onClick={() =>
                                setDayDialog({ date: r.date, mode: "edit" })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-full p-2 text-amber-800 hover:bg-amber-100/80"
                              aria-label="刪除當日紀錄"
                              onClick={() => setDeleteDate(r.date)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteDate !== null}
        title="刪除此日所有紀錄？"
        description="將移除該日所有打卡與「今日」自訂連結，統計會重算。不會刪除常用收藏裡的自訂項目本體。"
        confirmLabel="刪除"
        danger
        busy={deleteBusy}
        onCancel={() => setDeleteDate(null)}
        onConfirm={() => {
          if (!user?.id || !deleteDate) return;
          setDeleteBusy(true);
          void clearUserCalendarDay({ userId: user.id, date: deleteDate })
            .then(() => {
              setDeleteDate(null);
              void refetchWeekly();
            })
            .catch(() => {})
            .finally(() => setDeleteBusy(false));
        }}
      />

      {addDateOpen ? (
        <div
          className="fixed inset-0 z-[910] flex items-end justify-center bg-[rgba(45,52,40,0.22)] p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="填寫紀錄：選擇日期"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                填寫紀錄
              </p>
              <button
                type="button"
                onClick={() => setAddDateOpen(false)}
                className="rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-3 block text-xs text-[var(--color-ink-secondary)]">
              日期
              <input
                type="date"
                max={todayStr}
                min="2020-01-01"
                value={addDatePick}
                onChange={(e) => setAddDatePick(e.target.value)}
                onClick={(e) => {
                  try {
                    void e.currentTarget.showPicker?.();
                  } catch {
                    /* 已開啟或不允許時略過 */
                  }
                }}
                className="mt-1 w-full cursor-pointer rounded-lg border border-[var(--color-muted)] bg-[var(--color-white)] px-2 py-2 text-[var(--color-ink)]"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddDateOpen(false)}
                className="rounded-full border border-[var(--color-muted)] px-4 py-2 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!addDatePick || addDatePick > todayStr}
                onClick={() => {
                  if (!addDatePick || addDatePick > todayStr) return;
                  setAddDateOpen(false);
                  setDayDialog({ date: addDatePick, mode: "edit" });
                }}
                className="rounded-full bg-[var(--color-primary-strong)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                去填寫
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dayDialog ? (
        <div
          className="fixed inset-0 z-[920] flex items-end justify-center bg-[rgba(45,52,40,0.22)] p-2 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={
            dayDialog.mode === "view" ? "檢視該日清單" : "編輯該日清單"
          }
        >
          <div className="flex max-h-[min(92vh,56rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--color-bg)] shadow-2xl sm:max-w-xl">
            <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-muted)]/60 bg-[var(--color-surface)] px-2 py-2.5">
              <button
                type="button"
                disabled={!canDayPrev}
                onClick={() => {
                  setDayDialog((prev) => {
                    if (!prev) return prev;
                    const i = dayNavDates.indexOf(prev.date);
                    const d = dayNavDates[i - 1];
                    return d ? { ...prev, date: d } : prev;
                  });
                }}
                className="shrink-0 rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30 disabled:pointer-events-none disabled:opacity-30"
                aria-label="前一天"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="min-w-0 flex-1 text-center text-sm font-semibold text-[var(--color-ink)]">
                {dayDialog.date}
                <span className="block text-xs font-normal text-[var(--color-ink-secondary)]">
                  {dayDialog.mode === "view" ? "檢視" : "編輯"}
                </span>
              </p>
              <button
                type="button"
                disabled={!canDayNext}
                onClick={() => {
                  setDayDialog((prev) => {
                    if (!prev) return prev;
                    const i = dayNavDates.indexOf(prev.date);
                    const d = dayNavDates[i + 1];
                    return d ? { ...prev, date: d } : prev;
                  });
                }}
                className="shrink-0 rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30 disabled:pointer-events-none disabled:opacity-30"
                aria-label="後一天"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={closeDayDialog}
                className="shrink-0 rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
              <TodayChecklist
                key={dayDialog.date}
                selectedDate={dayDialog.date}
                variant={dayDialog.mode === "view" ? "readonly" : "interactive"}
                dayNoteControlled={{
                  value: dlgDayNote,
                  onChange: setDlgDayNote,
                  readOnly: dayDialog.mode === "view",
                  busyLoading: dlgDayNoteLoading,
                }}
              />
            </div>
            {dayDialog.mode === "edit" ? (
              <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-muted)]/50 bg-[var(--color-surface)] px-3 py-3">
                <button
                  type="button"
                  disabled={dlgDayNoteLoading || dlgDayNoteSaving}
                  onClick={() => {
                    if (!user?.id) return;
                    setDlgDayNoteSaving(true);
                    void upsertUserDayNote({
                      userId: user.id,
                      date: dayDialog.date,
                      note: dlgDayNote,
                    })
                      .then(() => closeDayDialog())
                      .catch(() => {})
                      .finally(() => setDlgDayNoteSaving(false));
                  }}
                  className="rounded-full bg-[#849B6D] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                >
                  {dlgDayNoteSaving ? "儲存中…" : "儲存並關閉"}
                </button>
              </div>
            ) : null}
          </div>
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
                {modal.date} 我的完成紀錄
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
