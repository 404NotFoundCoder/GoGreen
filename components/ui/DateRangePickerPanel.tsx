"use client";

import { TIMEZONE } from "@/constants/config";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISODay,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

function toYmd(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd");
}

function parseYmd(s: string): Date {
  return toZonedTime(parseISO(`${s}T12:00:00`), TIMEZONE);
}

function orderedRange(a: string, b: string): { lo: string; hi: string } {
  return a <= b ? { lo: a, hi: b } : { lo: b, hi: a };
}

function MonthGrid({
  monthAnchor,
  maxDateStr,
  lo,
  hi,
  onDayPointerDown,
}: {
  monthAnchor: Date;
  maxDateStr: string;
  lo: string;
  hi: string;
  onDayPointerDown: (d: string, pointerId: number) => void;
}) {
  const start = startOfMonth(monthAnchor);
  const end = endOfMonth(monthAnchor);
  const days = eachDayOfInterval({ start, end });
  const pad = getISODay(start) === 7 ? 6 : getISODay(start) - 1;
  const cells: (Date | null)[] = [...Array(pad).fill(null), ...days];

  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  return (
    <div className="min-w-[9.5rem] flex-1 sm:min-w-[11rem]">
      <p className="mb-2 text-center text-xs font-semibold text-[var(--color-ink)]">
        {formatInTimeZone(monthAnchor, TIMEZONE, "yyyy 年 M 月")}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] text-[var(--color-subtle)]">
        {WEEK_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-px">
        {cells.map((d, i) => {
          if (!d) {
            return (
              <div
                key={`e-${i}`}
                className="aspect-square min-h-[2.35rem] min-w-0 sm:min-h-[2.5rem]"
                aria-hidden
              />
            );
          }
          const ymd = toYmd(d);
          const future = ymd > maxDateStr;
          const inRange = !future && ymd >= lo && ymd <= hi;
          const mid = inRange && ymd !== lo && ymd !== hi;
          const endpoint = inRange && (ymd === lo || ymd === hi);

          return (
            <button
              key={ymd}
              type="button"
              data-calendar-day={ymd}
              disabled={future}
              onPointerDown={(e) => {
                if (future) return;
                e.preventDefault();
                onDayPointerDown(ymd, e.pointerId);
              }}
              className={[
                "relative flex aspect-square min-h-[2.35rem] min-w-0 items-center justify-center rounded-lg text-[11px] font-medium tabular-nums transition-colors sm:min-h-[2.5rem] sm:text-xs",
                future
                  ? "cursor-not-allowed text-[var(--color-muted)]/50"
                  : "cursor-pointer text-[var(--color-ink)]",
                mid ? "bg-[var(--color-primary-light)]" : "",
                endpoint ? "z-[1] text-[var(--color-white)]" : "",
              ].join(" ")}
            >
              {endpoint ? (
                <span
                  className="absolute inset-[2px] rounded-full bg-[var(--color-primary-strong)] shadow-sm"
                  aria-hidden
                />
              ) : null}
              <span className="relative z-[2]">{format(d, "d")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  maxDate: string;
  start: string;
  end: string;
  onRangeChange: (start: string, end: string) => void;
  onClear: () => void;
};

/**
 * 雙月曆＋指標拖曳選區（桌面／觸控皆以 document pointermove 追蹤）。
 */
export function DateRangePickerPanel({
  maxDate,
  start,
  end,
  onRangeChange,
  onClear,
}: Props) {
  const maxD = parseYmd(maxDate);
  const { lo: curLo, hi: curHi } = orderedRange(start, end);

  const [leftMonth, setLeftMonth] = useState(() =>
    startOfMonth(parseYmd(curLo)),
  );

  useEffect(() => {
    setLeftMonth(startOfMonth(parseYmd(curLo)));
  }, [curLo]);

  const rightMonth = useMemo(
    () => addMonths(leftMonth, 1),
    [leftMonth],
  );

  const dragRef = useRef<{
    anchor: string;
    pointerId: number;
  } | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  const previewLo = dragRef.current
    ? orderedRange(dragRef.current.anchor, dragEnd ?? dragRef.current.anchor).lo
    : curLo;
  const previewHi = dragRef.current
    ? orderedRange(dragRef.current.anchor, dragEnd ?? dragRef.current.anchor).hi
    : curHi;

  const clampToMax = useCallback(
    (s: string) => (s > maxDate ? maxDate : s),
    [maxDate],
  );

  const applyPreview = useCallback(
    (anchor: string, endHint: string) => {
      let lo = orderedRange(anchor, endHint).lo;
      let hi = orderedRange(anchor, endHint).hi;
      lo = clampToMax(lo);
      hi = clampToMax(hi);
      if (lo > hi) [lo, hi] = [hi, lo];
      onRangeChange(lo, hi);
    },
    [clampToMax, onRangeChange],
  );

  const readDayFromPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const el = document.elementFromPoint(clientX, clientY);
      const node = el?.closest("[data-calendar-day]");
      const raw = node?.getAttribute("data-calendar-day");
      if (!raw || raw > maxDate) return null;
      return raw;
    },
    [maxDate],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const hit = readDayFromPoint(e.clientX, e.clientY);
      if (hit) setDragEnd(hit);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const anchor = d.anchor;
      dragRef.current = null;
      setDragEnd(null);
      const hit = readDayFromPoint(e.clientX, e.clientY) ?? anchor;
      applyPreview(anchor, hit);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyPreview, readDayFromPoint]);

  const beginDrag = (ymd: string, pointerId: number) => {
    dragRef.current = { anchor: ymd, pointerId };
    setDragEnd(ymd);
  };

  const onStartInput = (v: string) => {
    if (!v) return;
    const lo = clampToMax(v);
    let hi = previewHi;
    if (hi < lo) hi = lo;
    onRangeChange(lo, clampToMax(hi));
  };

  const onEndInput = (v: string) => {
    if (!v) return;
    const hi = clampToMax(v);
    let lo = previewLo;
    if (lo > hi) lo = hi;
    onRangeChange(clampToMax(lo), hi);
  };

  const inputCls =
    "mt-0.5 w-full rounded-xl border border-[var(--color-muted)]/70 bg-[var(--color-surface)] px-2.5 py-2 text-sm font-semibold tabular-nums text-[var(--color-ink)] shadow-inner outline-none focus:border-[var(--color-primary)]/50 focus:ring-2 focus:ring-[var(--color-primary)]/20";

  const canPrev = isAfter(leftMonth, new Date(2019, 11, 1));
  const canNext = isBefore(leftMonth, startOfMonth(maxD));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 rounded-xl bg-[var(--color-white)]/60 px-1 py-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:gap-2">
        <label className="flex min-w-0 flex-col">
          <span className="text-[10px] font-medium text-[var(--color-subtle)]">
            開始
          </span>
          <input
            type="date"
            className={inputCls}
            max={maxDate}
            value={previewLo}
            onChange={(e) => onStartInput(e.target.value)}
            aria-label="開始日期"
          />
        </label>
        <span
          className="hidden pb-2 text-sm text-[var(--color-muted)] sm:block"
          aria-hidden
        >
          —
        </span>
        <label className="flex min-w-0 flex-col sm:text-right">
          <span className="text-[10px] font-medium text-[var(--color-subtle)] sm:text-right">
            結束
          </span>
          <input
            type="date"
            className={`${inputCls} sm:text-right`}
            max={maxDate}
            value={previewHi}
            onChange={(e) => onEndInput(e.target.value)}
            aria-label="結束日期"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setLeftMonth((m) => addMonths(m, -1))}
          className="rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)]/80 disabled:opacity-30"
          aria-label="上個月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setLeftMonth((m) => addMonths(m, 1))}
          className="rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)]/80 disabled:opacity-30"
          aria-label="下個月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <MonthGrid
          monthAnchor={leftMonth}
          maxDateStr={maxDate}
          lo={previewLo}
          hi={previewHi}
          onDayPointerDown={beginDrag}
        />
        <div className="hidden w-px shrink-0 bg-[var(--color-muted)]/30 sm:block" />
        <MonthGrid
          monthAnchor={rightMonth}
          maxDateStr={maxDate}
          lo={previewLo}
          hi={previewHi}
          onDayPointerDown={beginDrag}
        />
      </div>

      <p className="text-[10px] leading-snug text-[var(--color-subtle)]">
        可於上方直接選擇開始／結束日期；或在月曆上拖曳區間、單點選單日。不可選未來日期。
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-muted)]/30 pt-3">
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-4 py-2 text-xs font-medium text-[var(--color-ink-secondary)] hover:bg-[var(--color-muted)]/25"
        >
          清除
        </button>
      </div>
    </div>
  );
}
