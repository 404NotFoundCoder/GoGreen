"use client";

import { X } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";

import { parseInviteEmails } from "@/lib/utils/groupInvites";

function isLikelyEmail(s: string): boolean {
  const t = s.trim();
  return t.length > 3 && t.includes("@") && !t.endsWith("@");
}

type Props = {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function EmailChipsInput({
  emails,
  onChange,
  disabled,
  placeholder = "輸入信箱後按 Enter 或逗號",
}: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pushUnique = (next: string[]) => {
    const seen = new Set(emails.map((e) => e.toLowerCase()));
    const add: string[] = [];
    for (const e of next) {
      const k = e.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      add.push(e.trim());
    }
    if (add.length > 0) onChange([...emails, ...add]);
  };

  const commitDraft = () => {
    const t = draft.trim();
    if (!t) return;
    const parts = parseInviteEmails(t);
    const valid = parts.filter(isLikelyEmail);
    if (valid.length > 0) {
      pushUnique(valid);
      setDraft("");
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === "," || e.key === "，") {
      e.preventDefault();
      commitDraft();
    }
    if (e.key === "Backspace" && !draft && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (text.includes("@") && (text.includes(",") || text.includes("\n"))) {
      e.preventDefault();
      const parts = parseInviteEmails(text);
      pushUnique(parts.filter(isLikelyEmail));
      setDraft("");
    }
  };

  const removeAt = (index: number) => {
    onChange(emails.filter((_, i) => i !== index));
  };

  return (
    <div
      className={[
        "flex min-h-[52px] w-full flex-wrap items-center gap-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-2 py-2 pl-3",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)] transition-shadow focus-within:ring-2 focus-within:ring-[var(--color-primary-strong)]/30",
        disabled ? "opacity-50" : "",
      ].join(" ")}
      onClick={() => inputRef.current?.focus()}
    >
      {emails.map((em, i) => (
        <span
          key={`${em}-${i}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border-[0.5px] border-[var(--color-primary-strong)]/35 bg-[var(--color-primary-light)] px-2.5 py-1 text-sm text-[var(--color-ink)]"
        >
          <span className="max-w-[200px] truncate sm:max-w-[260px]">{em}</span>
          {!disabled ? (
            <button
              type="button"
              className="rounded-full p-0.5 text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-pale)] hover:text-[var(--color-ink)]"
              aria-label={`移除 ${em}`}
              onClick={(ev) => {
                ev.stopPropagation();
                removeAt(i);
              }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        inputMode="email"
        autoComplete="off"
        disabled={disabled}
        placeholder={emails.length === 0 ? placeholder : ""}
        className="min-h-[36px] min-w-[140px] flex-1 border-0 bg-transparent py-1 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-subtle)] focus:ring-0 focus:outline-none disabled:cursor-not-allowed"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (draft.trim()) commitDraft();
        }}
      />
    </div>
  );
}
