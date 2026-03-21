import { TodayChecklist } from "@/components/checklist/TodayChecklist";

export default function TodayPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">今日檢核</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          完成公版與自訂行動，累積分數與連續天數。
        </p>
      </header>
      <TodayChecklist />
    </>
  );
}
