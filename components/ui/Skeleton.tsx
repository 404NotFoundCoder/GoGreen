export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-[var(--color-surface-mid)] motion-safe:animate-pulse ${className}`}
      aria-hidden
    />
  );
}
