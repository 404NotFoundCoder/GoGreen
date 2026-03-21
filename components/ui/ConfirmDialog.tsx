"use client";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "確定",
  cancelLabel = "取消",
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center bg-[rgba(45,52,40,0.45)] p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="關閉"
        onClick={onCancel}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-5 shadow-lg"
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-desc" : undefined}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[var(--color-ink)]"
        >
          {title}
        </h2>
        {description ? (
          <p
            id="confirm-dialog-desc"
            className="mt-2 text-sm leading-relaxed text-[var(--color-ink-secondary)]"
          >
            {description}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={[
              "min-h-[44px] rounded-full px-4 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50",
              danger
                ? "bg-[#b45309] hover:bg-[#9a3412]"
                : "bg-[var(--color-primary-strong)]",
            ].join(" ")}
          >
            {busy ? "處理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
