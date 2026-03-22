"use client";

type Props = {
  open: boolean;
  memberName: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RemoveGroupMemberDialog({
  open,
  memberName,
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
        aria-labelledby="remove-member-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="remove-member-title"
          className="text-lg font-semibold text-[var(--color-ink)]"
        >
          移出成員
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          確定將「
          <span className="font-medium text-[var(--color-ink)]">{memberName}</span>
          」移出群組？對方需再以邀請碼或公開清單重新加入（若仍符合一人一群規則）。
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-[44px] rounded-full bg-[#b45309] px-4 py-2.5 text-sm font-medium text-[var(--color-white)] hover:bg-[#9a3412] disabled:opacity-50"
          >
            {busy ? "處理中…" : "確認移出"}
          </button>
        </div>
      </div>
    </div>
  );
}
