import { GlobalLeaderboardPanel } from "@/components/leaderboard/GlobalLeaderboardPanel";

export default function LeaderboardPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">全體排行榜</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          依時間範圍與維度切換；總加權為三維度線性積分加總。
        </p>
      </header>
      <GlobalLeaderboardPanel />
    </>
  );
}
