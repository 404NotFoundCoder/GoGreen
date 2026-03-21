"use client";

import { AddCustomForm } from "@/components/checklist/AddCustomForm";
import { ChecklistRow } from "@/components/checklist/ChecklistRow";
import { ChecklistStampCard } from "@/components/checklist/ChecklistStampCard";
import { EditCustomItemDialog } from "@/components/checklist/EditCustomItemDialog";
import { FavoritesPanel } from "@/components/checklist/FavoritesPanel";
import type { CustomItemRow } from "@/lib/supabase/checklist";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStreakTierBonus } from "@/constants/scoring";
import { useTodayChecklist } from "@/hooks/useTodayChecklist";
import { Flame, Leaf, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function BouncyNumber({ value }: { value: number }) {
  const prev = useRef(value);
  const elRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    const el = elRef.current;
    if (!el) return;
    el.classList.remove("gg-stat-bump");
    void el.offsetWidth;
    el.classList.add("gg-stat-bump");
  }, [value]);
  return (
    <span
      ref={elRef}
      className="inline-block tabular-nums text-[var(--color-ink)]"
    >
      {value}
    </span>
  );
}

function spawnDomConfetti() {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = [
    "#87986A",
    "#B5C99A",
    "#CFE1B9",
    "#E9F5DB",
    "#718355",
    "#97A97C",
  ];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement("div");
    p.className = "gg-confetti-piece";
    const size = 4 + Math.random() * 8;
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = "-10px";
    p.style.background = colors[Math.floor(Math.random() * colors.length)]!;
    p.style.animationDelay = `${Math.random() * 0.45}s`;
    p.style.animationDuration = `${0.85 + Math.random() * 0.45}s`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    document.body.appendChild(p);
    window.setTimeout(() => p.remove(), 2000);
  }
}

export function TodayChecklist() {
  const {
    items,
    customItems,
    checkinItemIds,
    checkinCustomIds,
    stats,
    loading,
    error,
    togglePublic,
    toggleCustom,
    addCustomToToday,
    addFavoriteOnly,
    linkFavoriteToToday,
    unlinkCustomFromToday,
    deleteFavoriteCustom,
    updateCustomItem,
    uploadPhoto,
    favoriteItems,
    photoByItemId,
    photoByCustomId,
    pendingPhotoUploads,
    pendingUnlinks,
    pendingDeletes,
    pendingUpdates,
    totalSlots,
    doneCount,
    allDone,
    date,
    pendingToggles,
    fullCompletionCelebrationTick,
  } = useTodayChecklist();

  const [showCelebrateOverlay, setShowCelebrateOverlay] = useState(false);
  const halfToastShown = useRef(false);
  const [showHalfToast, setShowHalfToast] = useState(false);
  const [dismissCelebrate, setDismissCelebrate] = useState(false);
  const lastCelebrationTickRef = useRef(0);
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);
  const [deleteFavoriteId, setDeleteFavoriteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<CustomItemRow | null>(null);

  /** 關閉全完成覆蓋層時重置（未全完成或無項目） */
  useEffect(() => {
    if (!allDone || totalSlots === 0) {
      setShowCelebrateOverlay(false);
    }
  }, [allDone, totalSlots]);

  /**
   * 僅在 `fullCompletionCelebrationTick` 遞增時觸發（使用者本次點擊剛好打滿）；
   * 初次載入已全完成 tick 仍為 0，不會進入此 effect。
   */
  useEffect(() => {
    if (fullCompletionCelebrationTick === 0) return;
    if (fullCompletionCelebrationTick === lastCelebrationTickRef.current) return;
    lastCelebrationTickRef.current = fullCompletionCelebrationTick;

    setDismissCelebrate(false);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setShowCelebrateOverlay(true);
      return;
    }
    const t1 = window.setTimeout(() => spawnDomConfetti(), 280);
    const t2 = window.setTimeout(() => setShowCelebrateOverlay(true), 850);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [fullCompletionCelebrationTick]);

  useEffect(() => {
    if (totalSlots < 2 || allDone) return;
    const half = Math.ceil(totalSlots / 2);
    if (doneCount === half && !halfToastShown.current) {
      halfToastShown.current = true;
      setShowHalfToast(true);
      const t = window.setTimeout(() => setShowHalfToast(false), 2500);
      return () => window.clearTimeout(t);
    }
  }, [doneCount, totalSlots, allDone]);

  useEffect(() => {
    if (!allDone) setDismissCelebrate(false);
  }, [allDone]);

  /** 覆蓋層顯示後 1500ms 自動關閉（可提前按「太棒了」） */
  useEffect(() => {
    if (!showCelebrateOverlay || dismissCelebrate) return;
    const t = window.setTimeout(() => setDismissCelebrate(true), 1500);
    return () => window.clearTimeout(t);
  }, [showCelebrateOverlay, dismissCelebrate]);

  const progressPct =
    totalSlots > 0 ? Math.min(100, (doneCount / totalSlots) * 100) : 0;

  const todayCustomIdSet = new Set(customItems.map((c) => c.id));

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4 text-[var(--color-ink)]">
        無法載入清單：{error.message}
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <ConfirmDialog
        open={unlinkTarget !== null}
        title="從今日清單移除？"
        description="會解除今日與此自訂項目的連結，並清除今日打卡紀錄。若仍為常用收藏，之後可從下方收藏再次「加入今日」。"
        confirmLabel="移除"
        onConfirm={() => {
          if (!unlinkTarget) return;
          const id = unlinkTarget;
          void unlinkCustomFromToday(id)
            .then(() => setUnlinkTarget(null))
            .catch(() => {});
        }}
        onCancel={() => setUnlinkTarget(null)}
        busy={
          unlinkTarget !== null && pendingUnlinks.has(unlinkTarget)
        }
      />
      <EditCustomItemDialog
        open={editItem !== null}
        item={editItem}
        busy={editItem !== null && pendingUpdates.has(editItem.id)}
        onClose={() => setEditItem(null)}
        onSave={async (title, sdgIds) => {
          if (!editItem) return;
          await updateCustomItem(editItem.id, title, sdgIds);
        }}
      />
      <ConfirmDialog
        open={deleteFavoriteId !== null}
        title="刪除此則收藏？"
        description="將永久刪除此自訂行動（含今日若已加入的項目與相關打卡紀錄）。此動作無法復原。"
        danger
        confirmLabel="刪除"
        onConfirm={() => {
          if (!deleteFavoriteId) return;
          const id = deleteFavoriteId;
          void deleteFavoriteCustom(id)
            .then(() => setDeleteFavoriteId(null))
            .catch(() => {});
        }}
        onCancel={() => setDeleteFavoriteId(null)}
        busy={
          deleteFavoriteId !== null && pendingDeletes.has(deleteFavoriteId)
        }
      />
      <h1 className="sr-only">今日檢核</h1>
      <div
        className={[
          "gg-milestone-toast pointer-events-none",
          showHalfToast ? "gg-milestone-toast--show" : "",
        ].join(" ")}
        role="status"
        aria-live="polite"
      >
        🌱 已完成一半！繼續加油
      </div>

      {allDone && totalSlots > 0 && showCelebrateOverlay && !dismissCelebrate ? (
        <div
          className="gg-celebrate-overlay fixed inset-0 z-[998] flex flex-col items-center justify-center gap-3 bg-[rgba(233,245,219,0.95)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebrate-title"
        >
          <div className="gg-celebrate-icon flex justify-center" aria-hidden>
            <Leaf
              className="text-[var(--color-primary-dark)]"
              strokeWidth={2}
              size={72}
            />
          </div>
          <p
            id="celebrate-title"
            className="gg-celebrate-title text-2xl font-bold text-[var(--color-ink)]"
          >
            今日全部完成！
          </p>
          <p className="gg-celebrate-sub text-sm text-[var(--color-ink-secondary)]">
            你為地球做出了改變 ✨
          </p>
          <button
            type="button"
            className="gg-celebrate-btn mt-2 min-h-[44px] rounded-full bg-[#87986A] px-6 py-2.5 text-sm font-medium text-white"
            onClick={() => setDismissCelebrate(true)}
          >
            太棒了
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] leading-snug text-[var(--color-ink-secondary)]">
            日期 (UTC+8) {date}
          </p>
          <button
            type="button"
            className="-m-2 shrink-0 rounded-full p-2 text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-ink)]"
            aria-label="更多"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {stats ? (
          <>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--color-ink-secondary)]">
                  進度
                </dt>
                <dd className="mt-0.5 text-[20px] font-bold tabular-nums text-[var(--color-ink)]">
                  {doneCount}/{totalSlots || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--color-ink-secondary)]">
                  今日得分
                </dt>
                <dd className="mt-0.5 text-[20px] font-bold tabular-nums text-[var(--color-ink)]">
                  <BouncyNumber value={stats.raw_score} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--color-ink-secondary)]">
                  連續天數
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
                  <span className="text-[20px] font-bold tabular-nums text-[var(--color-ink)]">
                    {stats.streak}天
                  </span>
                  <Flame
                    className="h-5 w-5 shrink-0 text-[#ea580c]"
                    aria-hidden
                  />
                  {getStreakTierBonus(stats.streak) > 0 ? (
                    <span className="gg-tier-badge inline-flex min-h-[22px] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                      🔥 +{getStreakTierBonus(stats.streak)}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-[#CFD5BD]">
                <div
                  className="h-full rounded-[3px] bg-[#87986A] transition-[width] duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>

      {totalSlots === 0 ? (
        <p className="rounded-2xl border-[0.5px] border-dashed border-[var(--color-muted)] bg-[var(--color-bg)] p-6 text-center leading-relaxed text-[var(--color-ink-secondary)]">
          尚無可用項目。請確認已在 Supabase 執行 migration 並建立預設公版。
        </p>
      ) : (
        <h2 className="mb-2.5 text-[11px] font-medium tracking-[0.08em] text-[var(--color-ink-secondary)] uppercase">
          今日行動
        </h2>
      )}

      {allDone &&
      totalSlots > 0 &&
      !showCelebrateOverlay &&
      (dismissCelebrate || fullCompletionCelebrationTick === 0) ? (
        <div
          className="rounded-2xl border-[0.5px] border-[var(--color-primary-dark)] bg-[var(--color-primary-light)] p-4 text-center text-[var(--color-primary-dark)]"
          role="status"
        >
          <p className="font-semibold">今日全部完成！</p>
          <p className="mt-1 text-sm">做得好，明天再見 🌿</p>
        </div>
      ) : null}

      {totalSlots > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              <ChecklistRow
                item={item}
                done={checkinItemIds.has(item.id)}
                disabled={pendingToggles.has(`p:${item.id}`)}
                onToggle={() => void togglePublic(item.id)}
                photoUrl={photoByItemId[item.id] ?? null}
                onUploadPhoto={
                  checkinItemIds.has(item.id)
                    ? (file) =>
                        void uploadPhoto({ itemId: item.id, file })
                    : undefined
                }
                photoUploadBusy={pendingPhotoUploads.has(`p:${item.id}`)}
              />
            </div>
          ))}
          {customItems.map((item) => (
            <div key={item.id}>
              <ChecklistStampCard
                done={checkinCustomIds.has(item.id)}
                disabled={pendingToggles.has(`c:${item.id}`)}
                onToggle={() => void toggleCustom(item.id)}
                title={item.title}
                metaLine={
                  <span>
                    自訂 · {item.is_favorite ? "已收藏" : "今日新增"}
                  </span>
                }
                sdgIds={item.sdg_ids ?? undefined}
                photoUrl={photoByCustomId[item.id] ?? null}
                onUploadPhoto={
                  checkinCustomIds.has(item.id)
                    ? (file) =>
                        void uploadPhoto({ customItemId: item.id, file })
                    : undefined
                }
                photoUploadBusy={pendingPhotoUploads.has(`c:${item.id}`)}
                onRequestRemoveFromToday={() => setUnlinkTarget(item.id)}
                removeFromTodayPending={pendingUnlinks.has(item.id)}
                onRequestEdit={() => setEditItem(item)}
                editPending={pendingUpdates.has(item.id)}
              />
            </div>
          ))}
        </div>
      ) : null}

      <section
        id="gg-custom-favorites-section"
        className="scroll-mt-6 overflow-hidden rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)]"
        aria-labelledby="gg-custom-favorites-title"
      >
        <div className="border-b-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)]/50 px-4 py-3.5">
          <h2
            id="gg-custom-favorites-title"
            className="text-base font-semibold text-[var(--color-ink)]"
          >
            自訂行動與常用收藏
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-secondary)]">
            新增時可比對常用並快速加入今日；編輯自訂會同步今日與收藏。
          </p>
        </div>
        <div className="divide-y divide-[var(--color-muted)]/70">
          <div className="p-4">
            <AddCustomForm
              embedded
              favoriteItems={favoriteItems}
              todayCustomIds={todayCustomIdSet}
              onQuickLinkFavorite={linkFavoriteToToday}
              onRequestEditFavorite={(id) => {
                const row = favoriteItems.find((f) => f.id === id);
                if (row) setEditItem(row);
              }}
              onRequestDeleteFavorite={(id) => setDeleteFavoriteId(id)}
              pendingEditIds={pendingUpdates}
              onAddToToday={addCustomToToday}
              onAddFavoriteOnly={addFavoriteOnly}
            />
          </div>
          <div className="bg-[var(--color-bg)]/25 p-4">
            <FavoritesPanel
              embedded
              items={favoriteItems}
              todayCustomIds={todayCustomIdSet}
              onLinkToToday={linkFavoriteToToday}
              onRequestDeleteFavorite={(id) => setDeleteFavoriteId(id)}
              onRequestEditFavorite={(id) => {
                const row = favoriteItems.find((f) => f.id === id);
                if (row) setEditItem(row);
              }}
              pendingDeleteIds={pendingDeletes}
              pendingEditIds={pendingUpdates}
              disabled={false}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
