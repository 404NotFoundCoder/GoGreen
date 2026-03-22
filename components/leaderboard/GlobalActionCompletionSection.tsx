"use client";

import { periodScopeLabel } from "@/components/leaderboard/LeaderboardPeriodBar";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  customRatePct,
  fetchCustomTitleCellParticipants,
  fetchCustomTitleDayDensityMap,
  fetchTemplateItemCellParticipants,
  fetchTemplateItemDayDensityMap,
  templateRatePct,
  type CellParticipant,
  type CustomTitleStatRow,
  type TemplateItemStatRow,
} from "@/lib/supabase/leaderboardActionHeatmap";
import { getLeaderboardDateBounds } from "@/lib/utils/leaderboardPeriod";
import type { LeaderboardPeriod } from "@/lib/utils/leaderboard";
import {
  resolveHeatmapLayoutForPeriod,
  type HeatmapLayout,
} from "@/lib/utils/heatmapLayout";
import { getTodayString, getYearStartString } from "@/lib/utils/date";
import { ChevronDown, X } from "lucide-react";
import { getISODay, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/constants/config";
import { useGlobalActionCompletionStats } from "@/hooks/useGlobalActionCompletionStats";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function keyString(k: RowKey): string {
  return k.kind === "template" ? `t:${k.itemId}` : `c:${k.title}`;
}

function ActionDensityHeatmap({
  layout,
  byDate,
  todayStr,
  onCellClick,
}: {
  layout: HeatmapLayout;
  byDate: Map<string, number>;
  todayStr: string;
  onCellClick: (date: string) => void;
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const v of byDate.values()) if (v > m) m = v;
    return m > 0 ? m : 1;
  }, [byDate]);

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
    return (
      <button
        type="button"
        disabled={future || n <= 0}
        title={
          future
            ? `${md} · 尚未到達`
            : `${md} · ${n} 人次${n > 0 ? "（點擊看名單）" : ""}`
        }
        onClick={() => {
          if (!future && n > 0) onCellClick(date);
        }}
        className={[
          "aspect-square w-full min-h-0 min-w-0 rounded-[2px] border border-[var(--color-muted)]/20 transition",
          bg,
          future || n <= 0
            ? "cursor-default opacity-50"
            : "cursor-pointer hover:ring-2 hover:ring-[var(--color-primary)]/40",
        ].join(" ")}
      />
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
    return (
      <div className="mt-2 w-full min-w-0">
        <div className="mb-1 grid grid-cols-7 gap-px text-center text-[9px] text-[var(--color-subtle)]">
          {["一", "二", "三", "四", "五", "六", "日"].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px [grid-template-columns:repeat(7,minmax(0,1fr))]">
          {layout.cells.map((d, i) => (
            <div key={d ?? `e-${i}`} className="min-w-0">
              {cell(d)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { weekCols, monthLabels } = layout;
  const n = weekCols.length;
  const weekdayRows = ["一", "", "三", "", "五", "", "日"] as const;
  const templateCols =
    n === 0 ? "1.25rem" : (`1.25rem repeat(${n}, minmax(12px, 1fr))` as const);

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
          className="min-w-0 self-stretch"
          style={{ gridColumn: wi + 2, gridRow: dayIdx + 2 }}
        >
          {date ? (
            cell(date)
          ) : (
            <div
              className="aspect-square w-full min-h-0 rounded-[2px] bg-transparent"
              aria-hidden
            />
          )}
        </div>
      );
    });
    return [left, ...cells];
  }).flat();

  const gridWidthStyle =
    n > 0
      ? ({
          width: `max(100%, calc(1.25rem + ${n} * 12px))`,
        } as const)
      : undefined;

  return (
    <div className="mt-2 w-full min-w-0 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] touch-pan-x md:overflow-x-visible">
      <div
        className="grid min-w-full max-w-none gap-px pb-1"
        style={{
          gridTemplateColumns: templateCols,
          gridTemplateRows: "auto repeat(7, auto)",
          ...gridWidthStyle,
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

export function GlobalActionCompletionSection({
  period,
}: {
  period: LeaderboardPeriod;
}) {
  const pl = periodScopeLabel(period);
  const bounds = getLeaderboardDateBounds(period);
  const chartStart = period === "all" ? getYearStartString() : bounds.start;
  const chartEnd = bounds.end;
  const todayStr = getTodayString();
  const layout = useMemo(
    () => resolveHeatmapLayoutForPeriod(period, chartStart, chartEnd),
    [period, chartStart, chartEnd],
  );

  const { templateRows, customRows, loadingList, listError } =
    useGlobalActionCompletionStats(period);

  const [expanded, setExpanded] = useState<RowKey | null>(null);
  const [densityMap, setDensityMap] = useState<Map<string, number>>(new Map());
  const [densityLoading, setDensityLoading] = useState(false);

  const [modal, setModal] = useState<{
    date: string;
    key: RowKey;
    participants: CellParticipant[];
    loading: boolean;
  } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [photoTab, setPhotoTab] = useState<"list" | "gallery">("list");

  useEffect(() => {
    if (!expanded) {
      setDensityMap(new Map());
      return;
    }
    let cancelled = false;
    setDensityLoading(true);
    void (async () => {
      try {
        const m =
          expanded.kind === "template"
            ? await fetchTemplateItemDayDensityMap(period, expanded.itemId)
            : await fetchCustomTitleDayDensityMap(period, expanded.title);
        if (!cancelled) setDensityMap(m);
      } catch {
        if (!cancelled) setDensityMap(new Map());
      } finally {
        if (!cancelled) setDensityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, period]);

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
    const sorted = [...templateRows].sort((a, b) => {
      const ra = templateRatePct(a);
      const rb = templateRatePct(b);
      if (rb !== ra) return rb - ra;
      return a.sortOrder - b.sortOrder;
    });
    return sorted;
  }, [templateRows]);

  const rankedCustom = useMemo(() => {
    return [...customRows].sort((a, b) => customRatePct(b) - customRatePct(a));
  }, [customRows]);

  function renderRow(
    rank: number,
    title: string,
    ratePct: number,
    subline: string,
    denomLine: string,
    rowKey: RowKey,
    maxRate: number,
  ) {
    const open = expanded && keyString(expanded) === keyString(rowKey);
    const barPct =
      maxRate > 0 ? Math.min(100, Math.round((ratePct / maxRate) * 100)) : 0;
    return (
      <div
        key={keyString(rowKey)}
        className="rounded-xl border-[0.5px] border-[var(--color-muted)]/80 bg-[var(--color-white)]/80"
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
        </p>
        <p className="px-3 pb-2 text-[10px] text-[var(--color-subtle)]">
          {denomLine}
        </p>
        {open ? (
          <div className="border-t border-[var(--color-muted)]/40 px-2 pb-3 pt-2">
            <p className="mb-1 text-[10px] text-[var(--color-subtle)]">
              與「我的」相同時間粒度之密度圖；色越深表示該日完成人次越高。
            </p>
            {densityLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : (
              <ActionDensityHeatmap
                layout={layout}
                byDate={densityMap}
                todayStr={todayStr}
                onCellClick={(d) => void openCell(d, rowKey)}
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
        `20260322142000_custom_title_stats_include_list_only.sql`）
      </p>
    );
  }

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)]/90 bg-[var(--color-surface)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">
        各項完成率（點開看密度圖）
      </h3>
      <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
        「{pl}」· 公版：完成率＝打卡人次 ÷（區間天數 × 期間內曾打卡人數）×
        100%。自訂：完成率＝打卡次數 ÷ 列入今日清單人日數（依標題彙總）× 100%。
      </p>
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
                : `分子＝完成 ${r.checkinCount} 次; 分母＝列入今日清單 ${r.onListDays} 人日；。`,
              { kind: "custom", title: r.title },
              maxCustomRate,
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
              {modal.loading ? (
                <p className="text-sm text-[var(--color-subtle)]">載入中…</p>
              ) : photoTab === "list" ? (
                <ul className="space-y-2">
                  {modal.participants.length === 0 ? (
                    <li className="text-sm text-[var(--color-subtle)]">
                      無紀錄
                    </li>
                  ) : (
                    modal.participants.map((p) => (
                      <li
                        key={p.userId}
                        className="flex items-center gap-3 rounded-xl border border-[var(--color-muted)]/50 px-3 py-2"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-sm font-semibold text-[var(--color-primary-dark)]">
                          {p.nickname.slice(0, 1) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-[var(--color-ink)]">
                            {p.nickname}
                          </p>
                          {p.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => setLightbox(p.photoUrl)}
                              className="text-xs text-[var(--color-primary-dark)] underline"
                            >
                              查看佐證
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--color-subtle)]">
                              無佐證照片
                            </span>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {modal.participants.filter((p) => p.photoUrl).length === 0 ? (
                    <p className="col-span-full text-sm text-[var(--color-subtle)]">
                      此日無佐證照片
                    </p>
                  ) : (
                    modal.participants
                      .filter((p) => p.photoUrl)
                      .map((p) => (
                        <button
                          key={`${p.userId}-ph`}
                          type="button"
                          onClick={() => setLightbox(p.photoUrl!)}
                          className="aspect-square overflow-hidden rounded-lg border border-[var(--color-muted)]/60 bg-[var(--color-white)]"
                          title={p.nickname}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.photoUrl!}
                            alt={`${p.nickname} 佐證`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))
                  )}
                </div>
              )}
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
