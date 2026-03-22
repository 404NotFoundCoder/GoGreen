"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type Props = {
  className?: string;
  children: React.ReactNode;
};

/** 首頁直接觸發 Google OAuth */
export function HomeGoogleStartButton({ className, children }: Props) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
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
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      className={className}
    >
      {busy ? "導向 Google…" : children}
    </button>
  );
}
