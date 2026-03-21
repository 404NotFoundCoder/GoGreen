"use client";

import { AddCustomForm } from "@/components/checklist/AddCustomForm";
import { ChecklistRow } from "@/components/checklist/ChecklistRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { SdgTag } from "@/components/ui/SdgTag";
import { useTodayChecklist } from "@/hooks/useTodayChecklist";
import type { CustomItemRow } from "@/lib/supabase/checklist";
import { Leaf } from "lucide-react";
import { useEffect, useRef } from "react";

function CustomChecklistRow({
  item,
  done,
  onToggle,
  disabled,
}: {
  item: CustomItemRow;
  done: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={[
        "flex min-h-[44px] w-full flex-col gap-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] p-4 text-left transition-transform motion-safe:duration-200",
        "bg-[var(--color-surface)]",
        done ? "bg-[var(--color-primary-light)]" : "",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px]",
            done
              ? "border-[var(--color-primary-dark)] bg-[var(--color-primary-pale)] text-[var(--color-primary-dark)]"
              : "border-[var(--color-muted)] bg-[var(--color-surface-mid)] text-[var(--color-subtle)]",
          ].join(" ")}
        >
          {done ? <Leaf className="h-4 w-4" strokeWidth={2.5} /> : null}
        </span>
        <div>
          <p className="text-[var(--color-ink)] font-medium">{item.title}</p>
          <p className="mt-0.5 text-xs text-[var(--color-ink-secondary)]">
            自訂 · {item.is_favorite ? "已收藏" : "今日新增"}
          </p>
        </div>
      </div>
      {item.sdg_ids?.length ? (
        <div className="flex flex-wrap gap-1.5 pl-11">
          {item.sdg_ids.map((id) => (
            <SdgTag key={id} id={id} />
          ))}
        </div>
      ) : null}
    </button>
  );
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
    addCustom,
    totalSlots,
    doneCount,
    allDone,
    date,
    pendingToggle,
  } = useTodayChecklist();

  const celebrated = useRef(false);

  useEffect(() => {
    if (!allDone || totalSlots === 0) {
      celebrated.current = false;
      return;
    }
    if (celebrated.current) return;
    celebrated.current = true;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    void import("canvas-confetti").then((mod) => {
      const c = mod.default;
      c({ particleCount: 80, spread: 70, origin: { y: 0.65 } });
    });
  }, [allDone, totalSlots]);

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
        <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-ink-secondary)]">日期（UTC+8）</p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
            {date}
          </p>
          {stats ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[var(--color-ink-secondary)]">進度</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {doneCount}/{totalSlots || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-secondary)]">今日得分</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {stats.raw_score}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-secondary)]">連續天數</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {stats.streak} 天
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        {totalSlots === 0 ? (
          <p className="rounded-2xl border-[0.5px] border-dashed border-[var(--color-muted)] bg-[var(--color-bg)] p-6 text-center leading-relaxed text-[var(--color-ink-secondary)]">
            尚無可用項目。請確認已在 Supabase 執行 migration 並建立預設公版。
          </p>
        ) : null}

        {allDone && totalSlots > 0 ? (
          <div
            className="rounded-2xl border-[0.5px] border-[var(--color-primary-dark)] bg-[var(--color-primary-light)] p-4 text-center text-[var(--color-primary-dark)]"
            role="status"
          >
            <p className="font-semibold">今日全部完成！</p>
            <p className="mt-1 text-sm">做得好，明天再見 🌿</p>
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="motion-safe:[transition:transform_0.25s_ease-out]"
            >
              <ChecklistRow
                item={item}
                done={checkinItemIds.has(item.id)}
                disabled={pendingToggle === `p:${item.id}`}
                onToggle={() => void togglePublic(item.id)}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {customItems.map((item) => (
            <CustomChecklistRow
              key={item.id}
              item={item}
              done={checkinCustomIds.has(item.id)}
              disabled={pendingToggle === `c:${item.id}`}
              onToggle={() => void toggleCustom(item.id)}
            />
          ))}
        </div>

        <AddCustomForm onSubmit={addCustom} />
    </div>
  );
}
