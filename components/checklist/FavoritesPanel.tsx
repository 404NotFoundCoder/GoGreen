"use client";

import { SdgTag } from "@/components/ui/SdgTag";
import type { CustomItemRow } from "@/lib/supabase/checklist";
import { Pencil, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  items: CustomItemRow[];
  /** 今日清單中已連結的自訂項目 id */
  todayCustomIds: Set<string>;
  onLinkToToday: (customItemId: string) => Promise<void>;
  onRequestDeleteFavorite: (customItemId: string) => void;
  onRequestEditFavorite?: (customItemId: string) => void;
  pendingDeleteIds?: Set<string>;
  pendingEditIds?: Set<string>;
  disabled?: boolean;
  /** 與新增表單同卡呈現時：不套用外層卡片邊框 */
  embedded?: boolean;
};

export function FavoritesPanel({
  items,
  todayCustomIds,
  onLinkToToday,
  onRequestDeleteFavorite,
  onRequestEditFavorite,
  pendingDeleteIds,
  pendingEditIds,
  disabled,
  embedded,
}: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => it.title.toLowerCase().includes(s));
  }, [items, q]);

  return (
    <div id={embedded ? undefined : "gg-favorites-section"} className={embedded ? "" : "scroll-mt-4 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4"}>
      {embedded ? (
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          常用收藏
        </h3>
      ) : (
        <>
          <p className="text-[var(--color-ink)] font-medium">常用收藏</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            管理常做的行動；一鍵加入今日清單。
          </p>
        </>
      )}
      {items.length > 0 ? (
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-subtle)]"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋收藏標題…"
            className={[
              "w-full min-h-[44px] rounded-xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] py-2.5 pl-9 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-subtle)]",
              q.length > 0 ? "pr-11" : "pr-3",
            ].join(" ")}
            aria-label="搜尋收藏"
          />
          {q.length > 0 ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-ink)]"
              aria-label="清除搜尋"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[var(--color-muted)] bg-[var(--color-bg)] px-3 py-4 text-center text-sm text-[var(--color-ink-secondary)]">
          尚無收藏。可在本區「新增項目」選「僅常用」，或勾選「加入今日時，同時加入常用收藏」。
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--color-muted)] bg-[var(--color-bg)] px-3 py-4 text-center text-sm text-[var(--color-ink-secondary)]">
          沒有符合「{q.trim()}」的收藏。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filtered.map((it) => {
            const inToday = todayCustomIds.has(it.id);
            const busy = pendingDeleteIds?.has(it.id);
            return (
              <li
                key={it.id}
                className="flex flex-col gap-2 rounded-xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                    {it.title}
                  </p>
                  {it.sdg_ids?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {it.sdg_ids.map((id) => (
                        <SdgTag key={id} id={id} showLabel />
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-end">
                  {inToday ? (
                    <span className="rounded-full bg-[var(--color-primary-pale)] px-3 py-1 text-xs font-medium text-[var(--color-primary-dark)]">
                      已在今日
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => void onLinkToToday(it.id)}
                      className="min-h-[40px] rounded-full border-[0.5px] border-[var(--color-primary-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-primary-dark)] disabled:opacity-50"
                    >
                      加入今日
                    </button>
                  )}
                  {onRequestEditFavorite ? (
                    <button
                      type="button"
                      disabled={disabled || busy || pendingEditIds?.has(it.id)}
                      onClick={() => onRequestEditFavorite(it.id)}
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
                      aria-label={`編輯「${it.title}」`}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => onRequestDeleteFavorite(it.id)}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[#b45309] disabled:opacity-50"
                    aria-label={`刪除收藏「${it.title}」`}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
