import { HomeAuthErrorBanner } from "@/components/home/HomeAuthErrorBanner";
import { HomeContentCarousel } from "@/components/home/HomeContentCarousel";
import { HomeGoogleStartButton } from "@/components/home/HomeGoogleStartButton";
import { BrandMark } from "@/components/layout/BrandMark";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

/** 與 `app/(app)/layout.tsx` 相同：伺服端 `getUser()`，避免客戶端 `getSession()` 與伺服端不一致造成 `/` ↔ `/today` 循環 */
export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/today");
  } catch {
    /* 未設定或錯誤的 .env：仍顯示行銷首頁（與舊行為一致） */
  }

  return (
    <>
      <Suspense fallback={null}>
        <HomeAuthErrorBanner />
      </Suspense>
      <main className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)] px-4 py-14 sm:py-20">
        <div className="mx-auto w-full max-w-3xl">
          <header className="text-center">
            <div className="flex justify-center">
              <BrandMark href="/" size="hero" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary-dark)] sm:text-sm">
              永續行動 × 遊戲化習慣
            </p>
            <h1 className="mx-auto mt-6 max-w-[18ch] text-balance text-3xl font-bold leading-[1.15] tracking-tight text-[var(--color-ink)] sm:max-w-none sm:text-4xl">
              把永續變成
              <br className="sm:hidden" />
              每天想打開的習慣
            </h1>

            <HomeContentCarousel />

            <div className="mt-12 flex justify-center sm:mt-14">
              <HomeGoogleStartButton className="inline-flex min-h-[52px] min-w-[220px] items-center justify-center rounded-full bg-[var(--color-primary-strong)] px-10 py-3.5 text-sm font-semibold text-[var(--color-white)] transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                我準備好了
              </HomeGoogleStartButton>
            </div>
          </header>
        </div>
      </main>
    </>
  );
}
