"use client";

import { GroupPeerDayPanel } from "@/components/groups/GroupPeerDayPanel";
import { ActionCompletionParticipantEvidence } from "@/components/leaderboard/ActionCompletionParticipantEvidence";
import { ProfileBinaryDensityHeatmap } from "@/components/profile/ProfileRecordsSection";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { DateRangePickerPanel } from "@/components/ui/DateRangePickerPanel";
import { SdgFilterBar } from "@/components/ui/SdgFilterBar";
import { SdgTagStrip } from "@/components/ui/SdgTagStrip";
import { useGroupActionCompletionStats } from "@/hooks/useGroupActionCompletionStats";
import { createClient } from "@/lib/supabase/client";
import { fetchGroupMemberIds } from "@/lib/supabase/leaderboard";
import {
  fetchGroupCustomTitleCellParticipants,
  fetchGroupCustomTitleExpandForRange,
  fetchGroupCustomTitlePhotoDatesSetForRange,
  fetchGroupPhotoDatesSetForRange,
  fetchGroupTemplateItemCellParticipants,
  fetchGroupTemplateItemExpandForRange,
  fetchGroupTemplateItemPhotoDatesSetForRange,
} from "@/lib/supabase/groupRecords";
import {
  customRatePct,
  templateRatePct,
  type CellParticipant,
} from "@/lib/supabase/leaderboardActionHeatmap";
import type { ActionCompletionPeriod } from "@/lib/utils/leaderboard";
import {
  actionCompletionScopeLabel,
  getActionCompletionDateBounds,
} from "@/lib/utils/leaderboardPeriod";
import {
  resolveHeatmapLayoutForActionCompletion,
  resolveHeatmapLayoutForDateRange,
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
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
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

type RowKey =
  | { kind: "template"; itemId: string }
  | { kind: "custom"; title: string };

const MAX_CUSTOM_RANGE_DAYS = 366;

function keyString(k: RowKey): string {
  return k.kind === "template" ? `t:${k.itemId}` : `c:${k.title}`;
}

type MemberStatRow = {
  user_id: string;
  date: string;
  completed_count: number | null;
  total_items: number | null;
  raw_score: number | null;
  streak: number | null;
};

type MemberProfileMini = {
  nickname: string;
  photoUrl: string | null;
};

export function GroupRecordsSection({ groupId }: { groupId: string }) {
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

  const {
    templateRows,
    customRows,
    loadingList,
    listError,
    listSilentEpoch,
  } = useGroupActionCompletionStats(groupId, effectiveBounds);

  const [expanded, setExpanded] = useState<RowKey | null>(null);
  useEffect(() => {
    setExpanded(null);
  }, [chartStart, chartEnd, groupId]);

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
  }, [chartStart, chartEnd, groupId]);

  const [weeklyByDate, setWeeklyByDate] = useState<Map<string, MemberStatRow[]>>(
    () => new Map(),
  );
  const [weeklyDates, setWeeklyDates] = useState<string[]>([]);
  const [weeklyProfiles, setWeeklyProfiles] = useState<
    Map<string, MemberProfileMini>
  >(() => new Map());
  const [photoDates, setPhotoDates] = useState<Set<string>>(() => new Set());
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [dayDialog, setDayDialog] = useState<string | null>(null);

  const refetchWeekly = useCallback(async () => {
    setWeeklyLoading(true);
    setWeeklyError(null);
    try {
      const memberIds = await fetchGroupMemberIds(groupId);
      if (memberIds.length === 0) {
        setWeeklyByDate(new Map());
        setWeeklyDates([]);
        setWeeklyProfiles(new Map());
        setPhotoDates(new Set());
        return;
      }
      const supabase = createClient();
      const [{ data: statsRows, error: statsErr }, { data: profs }] =
        await Promise.all([
          supabase
            .from("user_daily_stats")
            .select(
              "user_id, date, completed_count, total_items, raw_score, streak",
            )
            .in("user_id", memberIds)
            .gte("date", chartStart)
            .lte("date", chartEnd)
            .gt("completed_count", 0)
            .order("date", { ascending: true }),
          supabase
            .from("users")
            .select("id, nickname, photo_url")
            .in("id", memberIds),
        ]);
      if (statsErr) throw statsErr;
      const nick = new Map<string, MemberProfileMini>();
      for (const p of profs ?? []) {
        const id = p.id as string;
        const raw = p.photo_url as string | null | undefined;
        nick.set(id, {
          nickname: (p.nickname as string) ?? "—",
          photoUrl:
            typeof raw === "string" && raw.trim().length > 0
              ? raw.trim()
              : null,
        });
      }
      const byDate = new Map<string, MemberStatRow[]>();
      for (const r of (statsRows ?? []) as MemberStatRow[]) {
        const d = r.date;
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push(r);
      }
      const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
      setWeeklyByDate(byDate);
      setWeeklyDates(dates);
      setWeeklyProfiles(nick);
      const photos = await fetchGroupPhotoDatesSetForRange(
        groupId,
        chartStart,
        chartEnd,
      );
      setPhotoDates(photos);
    } catch (e) {
      setWeeklyError(e instanceof Error ? e.message : String(e));
    } finally {
      setWeeklyLoading(false);
    }
  }, [groupId, chartStart, chartEnd]);

  useEffect(() => {
    void refetchWeekly();
  }, [refetchWeekly]);

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
      groupId,
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
            await fetchGroupTemplateItemExpandForRange(
              groupId,
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
            await fetchGroupCustomTitleExpandForRange(
              groupId,
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
  }, [expanded, effectiveBounds, groupId, listSilentEpoch]);

  const openCell = useCallback(
    async (date: string, key: RowKey) => {
      setModal({ date, key, participants: [], loading: true });
      setPhotoTab("list");
      try {
        const rows =
          key.kind === "template"
            ? await fetchGroupTemplateItemCellParticipants(
                groupId,
                date,
                key.itemId,
              )
            : await fetchGroupCustomTitleCellParticipants(
                groupId,
                date,
                key.title,
              );
        setModal({ date, key, participants: rows, loading: false });
      } catch {
        setModal({ date, key, participants: [], loading: false });
      }
    },
    [groupId],
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
        g: groupId,
        s: chartStart,
        e: chartEnd,
        t: templateRowsFiltered.map((r) => r.itemId),
        c: customRowsFiltered.map((r) => r.title),
        rt: listSilentEpoch,
      }),
    [
      groupId,
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
            const s = await fetchGroupTemplateItemPhotoDatesSetForRange(
              groupId,
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
            const s = await fetchGroupCustomTitlePhotoDatesSetForRange(
              groupId,
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
  }, [mainTab, loadingList, effectiveBounds, rowPhotoSig, groupId]);

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
          className="flex w-full items-start gap-2 px-3 py-2.5 text-left sm:gap-3"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-xs font-bold text-[var(--color-primary-dark)]">
            {rank}
          </span>
          <span className="min-w-0 flex-1 whitespace-normal break-words font-medium leading-snug text-[var(--color-ink)]">
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
              與上方所選「{pl}」區間一致；格內為本群任一成員當日有打卡即綠底（人次）；該日有佐證圖時右下角顯示相機；點格可看本群完成者。
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

  const dayNavDates = useMemo(
    () => eachDateStringInRange(chartStart, chartEnd),
    [chartStart, chartEnd],
  );

  const dayNavIdx = dayDialog != null ? dayNavDates.indexOf(dayDialog) : -1;
  const canDayPrev = dayNavIdx > 0;
  const canDayNext = dayNavIdx >= 0 && dayNavIdx < dayNavDates.length - 1;

  const membersForDialog = useMemo(() => {
    if (!dayDialog) return [];
    const rows = weeklyByDate.get(dayDialog) ?? [];
    return [...rows].sort((a, b) => {
      const na = weeklyProfiles.get(a.user_id)?.nickname ?? "";
      const nb = weeklyProfiles.get(b.user_id)?.nickname ?? "";
      return na.localeCompare(nb, "zh-Hant");
    });
  }, [dayDialog, weeklyByDate, weeklyProfiles]);

  return (
    <div className="min-w-0 rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="mb-3 flex w-full flex-wrap items-center justify-center gap-2">
        <div
          className="inline-flex rounded-full border border-[var(--color-muted)]/60 bg-[var(--color-white)]/80 p-0.5 shadow-sm"
          role="tablist"
          aria-label="群組紀錄分頁"
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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          {mainTab === "completion"
            ? "各項完成率（本群，點開看密度圖）"
            : "每週紀錄（本群，唯讀）"}
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
              群組行動完成率載入失敗：{listError}（請套用 migration
              `20260322310000_group_records_rpcs.sql`）
            </p>
          ) : (
            <>
              <p className="mt-2 text-xs text-[var(--color-subtle)]">
                （
                {chartStart === chartEnd
                  ? chartStart
                  : `${chartStart}～${chartEnd}`}
                ）。公版：完成率＝本群該項打卡總次數 ÷（區間天數 ×
                本群活躍人數）× 100%。自訂：完成率＝本群打卡次數 ÷
                本群列入清單人日數 × 100%。
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
                      `${r.checkinCount} 次打卡（本群）`,
                      `分母＝區間 ${r.periodDays} 天 × 本群活躍 ${r.activeUsers} 人`,
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
                      `${r.checkinCount} 次打卡（本群）`,
                      r.legacyListDenominator
                        ? `分母估算＝${r.onListDays}（請套用 migration 20260322141000）。`
                        : `分母＝本群列入今日清單 ${r.onListDays} 人日。`,
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
            ）。僅列至少一位成員有打卡之日；點列或「檢視」可看該日各成員紀錄（唯讀）；可用標題列左右切換日期。
          </p>
          {weeklyLoading ? (
            <Skeleton className="mt-3 h-48 w-full rounded-xl" />
          ) : weeklyError ? (
            <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950">
              無法載入每週紀錄：{weeklyError}
            </p>
          ) : weeklyDates.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-secondary)]">
              此區間本群尚無成員打卡紀錄。
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-[0.5px] border-[var(--color-muted)] text-left text-[var(--color-ink-secondary)]">
                    <th className="py-2 pr-2 font-medium">日期</th>
                    <th className="py-2 pr-2 font-medium">打卡人數</th>
                    <th className="py-2 pr-2 font-medium text-center">照片</th>
                    <th className="py-2 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyDates.map((d) => {
                    const n = weeklyByDate.get(d)?.length ?? 0;
                    return (
                      <tr
                        key={d}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer border-b-[0.5px] border-[var(--color-muted)]/60 transition hover:bg-[var(--color-primary-light)]/20"
                        onClick={() => setDayDialog(d)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDayDialog(d);
                          }
                        }}
                      >
                        <td className="py-2 pr-2 tabular-nums font-medium text-[var(--color-ink)]">
                          {d}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-[var(--color-ink)]">
                          {n}
                        </td>
                        <td className="py-2 pr-2 text-center">
                          {photoDates.has(d) ? (
                            <Camera
                              className="mx-auto h-4 w-4 text-[var(--color-ink-secondary)]"
                              strokeWidth={2}
                              aria-label="本群當日有佐證照片"
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
                          <button
                            type="button"
                            className="rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
                            aria-label="檢視"
                            onClick={() => setDayDialog(d)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
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

      {dayDialog ? (
        <div
          className="fixed inset-0 z-[920] flex items-end justify-center bg-[rgba(45,52,40,0.22)] p-2 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="檢視本群該日紀錄"
        >
          <div className="flex max-h-[min(92vh,56rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--color-bg)] shadow-2xl sm:max-w-xl">
            <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-muted)]/60 bg-[var(--color-surface)] px-2 py-2.5">
              <button
                type="button"
                disabled={!canDayPrev}
                onClick={() => {
                  const i = dayNavDates.indexOf(dayDialog);
                  const prev = dayNavDates[i - 1];
                  if (prev) setDayDialog(prev);
                }}
                className="shrink-0 rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30 disabled:pointer-events-none disabled:opacity-30"
                aria-label="前一天"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="min-w-0 flex-1 text-center text-sm font-semibold text-[var(--color-ink)]">
                {dayDialog}
                <span className="block text-xs font-normal text-[var(--color-ink-secondary)]">
                  本群成員紀錄（唯讀）
                </span>
              </p>
              <button
                type="button"
                disabled={!canDayNext}
                onClick={() => {
                  const i = dayNavDates.indexOf(dayDialog);
                  const next = dayNavDates[i + 1];
                  if (next) setDayDialog(next);
                }}
                className="shrink-0 rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30 disabled:pointer-events-none disabled:opacity-30"
                aria-label="後一天"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setDayDialog(null)}
                className="shrink-0 rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/30"
                aria-label="關閉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
              {membersForDialog.length === 0 ? (
                <p className="text-sm text-[var(--color-subtle)]">
                  此日無成員打卡資料（或已切換至區間內其他日期）。
                </p>
              ) : (
                membersForDialog.map((row) => {
                  const prof = weeklyProfiles.get(row.user_id);
                  const nn = prof?.nickname ?? "—";
                  const av = prof?.photoUrl;
                  const cc = row.completed_count ?? 0;
                  const tt = row.total_items ?? 0;
                  const rs = row.raw_score ?? 0;
                  return (
                    <section
                      key={row.user_id}
                      className="mb-4 overflow-hidden rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-surface)] last:mb-0"
                    >
                      <div className="flex items-center gap-2 border-b border-[var(--color-muted)]/50 bg-[var(--color-white)]/60 px-3 py-2">
                        {av ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={av}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-[var(--color-primary-pale)]"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-sm font-semibold text-[var(--color-primary-dark)]">
                            {nn.trim().slice(0, 1) || "?"}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[var(--color-ink)]">
                            {nn}
                          </p>
                          <p className="text-[11px] tabular-nums text-[var(--color-ink-secondary)]">
                            進度 {cc}/{tt} · 得分 {rs} · 連續{" "}
                            {row.streak ?? 0} 天
                          </p>
                        </div>
                      </div>
                      <div className="p-2 sm:p-3">
                        <GroupPeerDayPanel
                          groupId={groupId}
                          peerUserId={row.user_id}
                          date={dayDialog}
                        />
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[900] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="本群完成者"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[min(85vh,32rem)] w-full max-w-md overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-muted)]/60 px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {modal.date} · 本群完成者
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
