"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LoginClient({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const supabase = createClient();
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) router.replace("/today");
      });
    } catch {
      /* 未設定 env 時仍顯示登入頁 */
    }
  }, [router]);

  const signInGoogle = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=/today`,
        },
      });
    } catch {
      alert("無法登入：請確認 .env.local 已設定正確的 Supabase URL 與 anon key");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-8">
        <h1 className="text-center text-2xl font-bold text-[var(--color-ink)]">
          GoGreen
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          使用 Google 登入，開始每日永續行動。
        </p>
        {initialError ? (
          <p className="mt-4 text-center text-sm text-red-800" role="alert">
            登入失敗，請重試。
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void signInGoogle()}
          className="mt-6 min-h-[44px] w-full rounded-full bg-[var(--color-primary-strong)] px-4 py-3 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
        >
          {busy ? "導向中…" : "以 Google 繼續"}
        </button>
        <p className="mt-6 text-center text-sm text-[var(--color-ink-secondary)]">
          <Link
            href="/"
            className="text-[var(--color-primary-dark)] underline underline-offset-2"
          >
            返回首頁
          </Link>
        </p>
      </div>
    </main>
  );
}
