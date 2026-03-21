import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/** 一律動態渲染，避免 next build 靜態產生時在無 Cookie 環境跑 auth */
export const dynamic = "force-dynamic";

/**
 * 在伺服器端驗證登入（讀取 .env.local + Cookie），不依賴 Edge Middleware。
 * 未登入則導向 /login。
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
