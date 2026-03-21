import { Check } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  className?: string;
};

/** 成功回饋：圓底＋打勾＋標題（動畫見 globals.css `.gg-success-*`） */
export function SuccessCheckmark({ title, subtitle, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col items-center text-center ${className}`}
      role="status"
    >
      <div className="gg-success-ring flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
        <Check
          className="gg-success-icon h-9 w-9 text-[var(--color-primary-dark)]"
          strokeWidth={2.5}
          aria-hidden
        />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--color-ink)]">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--color-ink-secondary)]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
