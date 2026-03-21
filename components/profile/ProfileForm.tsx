"use client";

import { SuccessCheckmark } from "@/components/ui/SuccessCheckmark";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProfile } from "@/hooks/useProfile";
import { dispatchProfileRefresh } from "@/lib/profileEvents";
import { useState } from "react";

export function ProfileForm() {
  const { nickname, setNickname, loading, error, save } = useProfile();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    setSaved(false);
    try {
      await save(nickname);
      setSaved(true);
      dispatchProfileRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (saved) {
    return (
      <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-6">
        <SuccessCheckmark
          title="已儲存暱稱"
          subtitle="排行榜與側欄會顯示最新暱稱"
        />
        <button
          type="button"
          onClick={() => setSaved(false)}
          className="mt-6 min-h-[44px] w-full rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-primary-light)]"
        >
          繼續編輯
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">暱稱</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
        顯示於排行榜與側欄；可隨時修改。
      </p>
      <input
        className="mt-3 w-full min-h-[44px] rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={32}
      />
      {error ? (
        <p className="mt-2 text-sm text-red-800">{error.message}</p>
      ) : null}
      {msg ? (
        <p className="mt-2 text-sm text-red-800" role="alert">
          {msg}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSave()}
        className="mt-3 min-h-[44px] w-full rounded-full bg-[var(--color-primary-strong)] px-4 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
      >
        {busy ? "儲存中…" : "儲存"}
      </button>
    </div>
  );
}
