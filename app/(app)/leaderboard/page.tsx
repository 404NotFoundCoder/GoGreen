import { LeaderboardShell } from "@/components/leaderboard/LeaderboardShell";

export default function LeaderboardPage() {
  return (
    <>
      <header className="mb-8 space-y-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--color-primary-dark)] uppercase">
          Leaderboard
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          排行榜
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          切換全體、群組內、各群組間與個人視角；支援本週／本月／累計。群組對群組以成員
          <strong className="font-semibold text-[var(--color-ink)]">
            平均標準化分
          </strong>
          等聚合後排名。
        </p>
      </header>
      <LeaderboardShell />
    </>
  );
}
