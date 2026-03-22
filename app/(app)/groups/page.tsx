import { GroupHub } from "@/components/groups/GroupHub";

export default function GroupsPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">群組</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]"></p>
      </header>
      <GroupHub />
    </>
  );
}
