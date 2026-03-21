"use client";

import { CUSTOM_ITEM_MAX_LENGTH } from "@/constants/config";
import { SDG_DEFINITIONS } from "@/constants/sdg";
import { SdgTag } from "@/components/ui/SdgTag";
import { useState } from "react";

type Props = {
  onSubmit: (title: string, sdgIds: number[], favorite: boolean) => Promise<void>;
  disabled?: boolean;
};

export function AddCustomForm({ onSubmit, disabled }: Props) {
  const [title, setTitle] = useState("");
  const [sdgIds, setSdgIds] = useState<number[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setBusy(true);
    try {
      await onSubmit(t, sdgIds, favorite);
      setTitle("");
      setSdgIds([]);
      setFavorite(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
      <p className="text-[var(--color-ink)] font-medium">新增今日自訂行動</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
        可選擇 SDG 標籤；完成得分與公版相同。
      </p>
      <input
        maxLength={CUSTOM_ITEM_MAX_LENGTH}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例如：自備購物袋"
        disabled={disabled || busy}
        className="mt-3 w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-subtle)]"
      />
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
          className="h-5 w-5 rounded border-[var(--color-muted)] accent-[var(--color-primary-strong)]"
        />
        同時加入常用收藏
      </label>
      {err ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void submit()}
        className="mt-3 min-h-[44px] w-full rounded-full bg-[var(--color-primary-strong)] px-4 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
      >
        {busy ? "送出中…" : "加入今日清單"}
      </button>
    </div>
  );
}
