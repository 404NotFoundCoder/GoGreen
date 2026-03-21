import { GroupHub } from "@/components/groups/GroupHub";

export default function GroupsPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">群組</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          加入群組後，公版清單會以該群組範本為準（依加入時間取第一個群組）。
        </p>
      </header>
      <GroupHub />
    </>
  );
}
