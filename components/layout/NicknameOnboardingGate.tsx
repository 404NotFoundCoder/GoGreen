"use client";

import { SuccessCheckmark } from "@/components/ui/SuccessCheckmark";
import { completeNicknameOnboarding, fetchProfile } from "@/lib/supabase/users";
import { dispatchProfileRefresh } from "@/lib/profileEvents";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 新帳號首次進入 App 時要求確認暱稱；曾完成引導者不再顯示。
 * 需 DB migration：`onboarding_completed` 欄位。
 */
export function NicknameOnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    if (!user) return;
    try {
      const row = await fetchProfile(user.id);
      if (!row?.onboarding_completed) {
        setNickname(row?.nickname?.trim() ?? "");
        setOpen(true);
      } else {
        setOpen(false);
      }
    } catch {
      setOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    void sync();
  }, [user, authLoading, sync]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const submit = async () => {
    if (!user) return;
    const n = nickname.trim();
    if (!n) {
      setErr("請輸入暱稱");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await completeNicknameOnboarding(user.id, n);
      setSuccess(true);
      dispatchProfileRefresh();
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {children}
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-ink)]/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nickname-onboarding-title"
        >
          <div className="w-full max-w-md rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] p-6">
            {success ? (
              <SuccessCheckmark
                title="暱稱已設定"
                subtitle="準備開始你的永續行動吧"
              />
            ) : (
              <>
                <h2
                  id="nickname-onboarding-title"
                  className="text-lg font-semibold text-[var(--color-ink)]"
                >
                  歡迎來到 GoGreen
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
                  設定在排行榜與群組中顯示的暱稱。之後可在「我」頁面修改。
                </p>
                <label className="mt-4 block text-sm font-medium text-[var(--color-ink)]">
                  暱稱
                  <input
                    className="mt-1.5 w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-3 py-2.5 text-[var(--color-ink)]"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={40}
                    autoComplete="nickname"
                    disabled={busy}
                  />
                </label>
                {err ? (
                  <p className="mt-2 text-sm text-red-800" role="alert">
                    {err}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="mt-6 min-h-[44px] w-full rounded-full bg-[var(--color-primary-strong)] px-4 py-3 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
                >
                  {busy ? "儲存中…" : "開始使用"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
