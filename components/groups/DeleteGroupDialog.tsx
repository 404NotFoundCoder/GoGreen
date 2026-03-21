"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  groupName: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteGroupDialog({
  open,
  groupName,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open, groupName]);

  if (!open) return null;

  const match = confirmText.trim() === groupName.trim();

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
        aria-labelledby="delete-group-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="delete-group-title"
          className="text-lg font-semibold text-[var(--color-ink)]"
        >
          刪除群組
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          將永久刪除此群組，所有成員會一併移除。此操作無法復原。
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">
          請輸入群組名稱「<span className="text-[var(--color-primary-dark)]">{groupName}</span>」以確認。
        </p>
        <input
          type="text"
          autoComplete="off"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-2 w-full rounded-xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5 text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)]/35"
          placeholder="輸入群組全名"
          aria-label="確認群組名稱"
        />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || !match}
            onClick={onConfirm}
            className="min-h-[44px] rounded-full bg-[#b45309] px-4 py-2.5 text-sm font-medium text-[var(--color-white)] hover:bg-[#9a3412] disabled:opacity-50"
          >
            {busy ? "刪除中…" : "永久刪除"}
          </button>
        </div>
      </div>
    </div>
  );
}
