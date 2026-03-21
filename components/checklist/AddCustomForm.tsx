"use client";

import { CUSTOM_ITEM_MAX_LENGTH } from "@/constants/config";
import { SDG_DEFINITIONS } from "@/constants/sdg";
import { SdgTag } from "@/components/ui/SdgTag";
import type { CustomItemRow } from "@/lib/supabase/checklist";
import { Bookmark, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  onAddToToday: (
    title: string,
    sdgIds: number[],
    alsoFavorite: boolean,
  ) => Promise<void>;
  onAddFavoriteOnly: (title: string, sdgIds: number[]) => Promise<void>;
  disabled?: boolean;
  embedded?: boolean;
  /** 用於輸入時比對：與「搜尋收藏標題」相同邏輯 */
  favoriteItems?: CustomItemRow[];
  todayCustomIds?: Set<string>;
  onQuickLinkFavorite?: (customItemId: string) => Promise<void>;
  onRequestEditFavorite?: (customItemId: string) => void;
  onRequestDeleteFavorite?: (customItemId: string) => void;
  pendingEditIds?: Set<string>;
};

export function AddCustomForm({
  onAddToToday,
  onAddFavoriteOnly,
  disabled,
  embedded,
  favoriteItems = [],
  todayCustomIds,
  onQuickLinkFavorite,
  onRequestEditFavorite,
  onRequestDeleteFavorite,
  pendingEditIds,
}: Props) {
  const [title, setTitle] = useState("");
  const [sdgIds, setSdgIds] = useState<number[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggleSdg = (id: number) => {
    setSdgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const trimmed = title.trim();
  const q = trimmed.toLowerCase();

  /** 與下方「搜尋收藏」相同：標題包含查詢字串（不分大小寫） */
  const matchingFavorites = useMemo(() => {
    if (!favoriteItems.length || q.length < 1) return [];
    const list = favoriteItems.filter((f) => f.title.toLowerCase().includes(q));
    return list.sort((a, b) => {
      const ae = a.title.trim().toLowerCase() === trimmed.toLowerCase() ? 0 : 1;
      const be = b.title.trim().toLowerCase() === trimmed.toLowerCase() ? 0 : 1;
      if (ae !== be) return ae - be;
      return a.title.localeCompare(b.title, "zh-Hant");
    });
  }, [favoriteItems, q, trimmed]);

  const showMatchPanel = q.length >= 1 && favoriteItems.length > 0;

  const submitToday = async () => {
    const t = title.trim();
    if (!t) {
      setErr("請輸入標題");
      return;
    }
    setErr(null);
    // 與既有常用標題完全相同：改為「連結今日」，避免重複建立 custom_items
    const exact = favoriteItems.find(
      (f) => f.title.trim().toLowerCase() === t.toLowerCase(),
    );
    if (exact && onQuickLinkFavorite) {
      if (todayCustomIds?.has(exact.id)) {
        setErr("已有同名常用且在今日清單，無需重複新增。");
        return;
      }
      setBusy(true);
      try {
        await onQuickLinkFavorite(exact.id);
        setTitle("");
        setSdgIds([]);
        setFavorite(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "加入失敗");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await onAddToToday(t, sdgIds, favorite);
      setTitle("");
      setSdgIds([]);
      setFavorite(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  };

  const submitFavoriteOnly = async () => {
    const t = title.trim();
    if (!t) {
      setErr("請輸入標題");
      return;
    }
    const exact = favoriteItems.find(
      (f) => f.title.trim().toLowerCase() === t.toLowerCase(),
    );
    if (exact) {
      setErr(
        "已有相同標題的常用收藏。請使用「加入今日清單」或上方「使用此常用」，或至下方編輯既有項目。",
      );
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await onAddFavoriteOnly(t, sdgIds);
      setTitle("");
      setSdgIds([]);
      setFavorite(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  };

  const runQuickLink = async (id: string) => {
    if (!onQuickLinkFavorite) return;
    setQuickBusy(id);
    setErr(null);
    try {
      await onQuickLinkFavorite(id);
      setTitle("");
      setSdgIds([]);
      setFavorite(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加入失敗");
    } finally {
      setQuickBusy(null);
    }
  };

  return (
    <div
      id={embedded ? undefined : "gg-add-custom-section"}
      className={
        embedded
          ? ""
          : "scroll-mt-6 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4"
      }
    >
      {!embedded ? (
        <>
          <p className="text-[var(--color-ink)] font-medium">
            新增今日自訂行動
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            可選擇 SDG 標籤；完成得分與公版相同。
          </p>
        </>
      ) : (
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">
          新增項目
        </h3>
      )}
      <div
        className={[
          "overflow-hidden rounded-xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)]",
          embedded ? "mt-2" : "mt-3",
        ].join(" ")}
      >
        <div className="relative">
          <input
            maxLength={CUSTOM_ITEM_MAX_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="輸入你的永續行動..."
            disabled={disabled || busy}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showMatchPanel}
            className={[
              "w-full border-0 bg-transparent py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-subtle)] focus:ring-0 focus:outline-none",
              title.length > 0 ? "pl-3 pr-11" : "px-3",
            ].join(" ")}
          />
          {title.length > 0 ? (
            <button
              type="button"
              disabled={disabled || busy || Boolean(quickBusy)}
              onClick={() => {
                setTitle("");
                setErr(null);
              }}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-ink)] disabled:opacity-40"
              aria-label="清除文字"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        {showMatchPanel ? (
          <div className="border-t-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)]/60">
            <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-[var(--color-ink-secondary)]">
              符合的常用收藏
            </p>
            {matchingFavorites.length === 0 ? (
              <p className="px-3 pb-3 text-center text-xs leading-relaxed text-[var(--color-ink-secondary)]">
                沒有符合的常用。可直接填寫並新增，或至下方搜尋全部收藏。
              </p>
            ) : (
              <ul className="max-h-[min(50vh,280px)] space-y-2 overflow-y-auto px-2 pb-2">
                {matchingFavorites.map((it) => {
                  const inToday = todayCustomIds?.has(it.id) ?? false;
                  const isExact =
                    trimmed.length > 0 &&
                    it.title.trim().toLowerCase() === trimmed.toLowerCase();
                  return (
                    <li
                      key={it.id}
                      className={[
                        "flex flex-col gap-2 rounded-xl border-[0.5px] bg-[var(--color-white)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                        isExact
                          ? "border-[var(--color-primary-strong)] ring-1 ring-[var(--color-primary)]/25"
                          : "border-[var(--color-muted)]",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                          {it.title}
                          {isExact ? (
                            <span className="ml-1.5 text-[10px] font-normal text-[var(--color-primary-dark)]">
                              （完全相同）
                            </span>
                          ) : null}
                        </p>
                        {it.sdg_ids?.length ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {it.sdg_ids.map((sid) => (
                              <SdgTag key={sid} id={sid} showLabel />
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
                            disabled={disabled || Boolean(quickBusy)}
                            onClick={() => void runQuickLink(it.id)}
                            className="min-h-[40px] rounded-full border-[0.5px] border-[var(--color-primary-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-primary-dark)] disabled:opacity-50"
                          >
                            {quickBusy === it.id ? "…" : "加入今日"}
                          </button>
                        )}
                        {onRequestEditFavorite ? (
                          <button
                            type="button"
                            disabled={
                              disabled ||
                              Boolean(quickBusy) ||
                              pendingEditIds?.has(it.id)
                            }
                            onClick={() => onRequestEditFavorite(it.id)}
                            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
                            aria-label={`編輯「${it.title}」`}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2} />
                          </button>
                        ) : null}
                        {onRequestDeleteFavorite ? (
                          <button
                            type="button"
                            disabled={disabled || Boolean(quickBusy)}
                            onClick={() => onRequestDeleteFavorite(it.id)}
                            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[#b45309] disabled:opacity-50"
                            aria-label={`刪除收藏「${it.title}」`}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] p-2">
        <div className="flex flex-wrap gap-1">
          {SDG_DEFINITIONS.map((s) => {
            const on = sdgIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSdg(s.id)}
                className={[
                  "min-h-[32px] rounded-full px-2 py-1 text-xs",
                  on ? "ring-2 ring-[var(--color-primary-dark)]" : "opacity-80",
                ].join(" ")}
              >
                <SdgTag id={s.id} showLabel />
              </button>
            );
          })}
        </div>
      </div>
      <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-[var(--color-ink-secondary)]">
        <input
          type="checkbox"
          checked={favorite}
          onChange={(e) => setFavorite(e.target.checked)}
          className="h-5 w-5 shrink-0 rounded border-[var(--color-muted)] accent-[var(--color-primary-strong)]"
        />
        加入今日時，同時加入常用收藏
      </label>
      {err ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}
      <div className="mt-3 flex min-h-[44px] gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void submitToday()}
          className="flex min-h-[44px] min-w-0 flex-[7] items-center justify-center gap-2 rounded-full bg-[var(--color-primary-strong)] px-3 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className="truncate">{busy ? "送出中…" : "加入今日清單"}</span>
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void submitFavoriteOnly()}
          className="flex min-h-[44px] min-w-0 flex-[3] items-center justify-center gap-1 rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-2 py-2.5 text-xs font-medium text-[var(--color-ink)] disabled:opacity-50 sm:text-sm"
        >
          <Bookmark
            className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
            strokeWidth={2}
            aria-hidden
          />
          <span className="truncate">{busy ? "…" : "僅常用"}</span>
        </button>
      </div>
    </div>
  );
}
