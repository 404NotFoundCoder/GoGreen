"use client";

import { CUSTOM_ITEM_MAX_LENGTH } from "@/constants/config";
import { SDG_DEFINITIONS } from "@/constants/sdg";
import { SdgTag } from "@/components/ui/SdgTag";
import type { CustomItemRow } from "@/lib/supabase/checklist";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  item: CustomItemRow | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (title: string, sdgIds: number[]) => Promise<void>;
};

export function EditCustomItemDialog({
  open,
  item,
  busy,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [sdgIds, setSdgIds] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setTitle(item.title);
    setSdgIds([...(item.sdg_ids ?? [])]);
    setErr(null);
  }, [open, item]);

  if (!open || !item) return null;

  const toggleSdg = (id: number) => {
    setSdgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      setErr("請輸入標題");
      return;
    }
    setErr(null);
    try {
      await onSave(t, sdgIds);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "儲存失敗");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center bg-[rgba(45,52,40,0.45)] p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="關閉"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-5 shadow-lg"
        role="dialog"
        aria-labelledby="edit-custom-title"
        aria-modal="true"
      >
        <h2
          id="edit-custom-title"
          className="text-lg font-semibold text-[var(--color-ink)]"
        >
          編輯自訂行動
        </h2>
        <p className="mt-1 text-xs text-[var(--color-ink-secondary)]">
          修改後會同步於今日清單與常用收藏（同一筆資料）。
        </p>
        <input
          maxLength={CUSTOM_ITEM_MAX_LENGTH}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-3 w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5 text-[var(--color-ink)]"
          disabled={busy}
        />
        <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] p-2">
          <div className="flex flex-wrap gap-1">
            {SDG_DEFINITIONS.map((s) => {
              const on = sdgIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
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
        {err ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-[44px] rounded-full bg-[var(--color-primary-strong)] px-4 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
          >
            {busy ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
