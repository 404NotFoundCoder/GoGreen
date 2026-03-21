import { HomeAuthRedirect } from "@/components/home/HomeAuthRedirect";
import Link from "next/link";

/** 首頁不呼叫 Supabase 伺服器端，避免未設定 .env 時整站 500 */
export default function Home() {
  return (
    <>
      <HomeAuthRedirect />
      <main className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)] px-4 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-3xl font-bold text-[var(--color-ink)]">GoGreen</h1>
          <p className="mt-4 text-lg leading-relaxed text-[var(--color-ink-secondary)]">
            以聯合國 SDG 為核心的每日永續行動檢核。完成行動、累積分數，與群組一起成長。
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] min-w-[200px] items-center justify-center rounded-full bg-[var(--color-primary-strong)] px-6 py-3 text-sm font-medium text-[var(--color-white)]"
            >
              開始使用
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-6 py-3 text-sm font-medium text-[var(--color-ink)]"
            >
              登入
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
