"use client";

import { createClient } from "@/lib/supabase/client";
import { useProfileNickname } from "@/hooks/useProfileNickname";
import { useAuthContext } from "@/context/AuthContext";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

function sessionAvatarUrl(meta: Record<string, unknown>): string | undefined {
  const a = meta.avatar_url ?? meta.picture;
  return typeof a === "string" && a.length > 0 ? a : undefined;
}

/** OAuth 後備顯示名（僅在暱稱尚未載入時） */
function fallbackDisplayName(
  meta: Record<string, unknown>,
  email?: string | null,
) {
  const n = meta.full_name ?? meta.name;
  if (typeof n === "string" && n.trim()) return n.trim();
  if (email) return email.split("@")[0] ?? "使用者";
  return "使用者";
}

function AvatarImg({
  url,
  size,
}: {
  url?: string;
  size: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? 36 : size === "md" ? 44 : 48;
  const cls =
    size === "sm"
      ? "h-9 w-9"
      : size === "md"
        ? "h-11 w-11"
        : "h-12 w-12";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={dim}
        height={dim}
        className={`${cls} shrink-0 rounded-full object-cover ring-2 ring-[var(--color-primary-pale)] ring-offset-2 ring-offset-[var(--color-bg)]`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-[var(--color-primary-dark)] ring-2 ring-[var(--color-muted)] ring-offset-2 ring-offset-[var(--color-bg)]`}
      aria-hidden
    >
      <User className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}

type Props = { variant: "sidebar" | "bar" };

export function UserAccountMenu({ variant }: Props) {
  const menuId = useId();
  const { user, loading: authLoading } = useAuthContext();
  const { nickname, loading: nickLoading } = useProfileNickname();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    setOpen(false);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const loading = authLoading || nickLoading;

  if (loading) {
    return (
      <div
        className={
          variant === "bar"
            ? "h-11 w-11 animate-pulse rounded-full bg-[var(--color-surface-mid)]"
            : "h-[4.5rem] w-full animate-pulse rounded-2xl bg-[var(--color-surface-mid)]"
        }
        aria-hidden
      />
    );
  }
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const avatarUrl = sessionAvatarUrl(meta);
  const displayName =
    nickname && nickname.length > 0
      ? nickname
      : fallbackDisplayName(meta, user.email);

  const panel = (
    <div
      id={menuId}
      role="menu"
      className={[
        "overflow-hidden rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] py-1",
        variant === "sidebar"
          ? "absolute bottom-full left-0 right-0 z-[60] mb-2"
          : "absolute right-0 top-full z-[60] mt-2 min-w-[200px]",
      ].join(" ")}
    >
      <Link
        href="/profile"
        role="menuitem"
        className="flex min-h-[44px] items-center px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-primary-light)]"
        onClick={() => setOpen(false)}
      >
        個人資料
      </Link>
      <div className="mx-3 h-px bg-[var(--color-muted)]" aria-hidden />
      <button
        type="button"
        role="menuitem"
        disabled={signingOut}
        className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-primary-light)] disabled:opacity-50"
        onClick={() => void signOut()}
      >
        <LogOut className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        {signingOut ? "登出中…" : "登出"}
      </button>
    </div>
  );

  if (variant === "bar") {
    return (
      <div className="relative flex shrink-0 justify-end" ref={wrapRef}>
        <button
          type="button"
          className="rounded-full p-0.5 outline-none transition ring-offset-2 ring-offset-[var(--color-surface)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          aria-label={`帳號選單，${displayName}`}
          onClick={() => setOpen((v) => !v)}
        >
          <AvatarImg url={avatarUrl} size="sm" />
        </button>
        {open ? panel : null}
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={wrapRef}>
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] p-2.5 text-left outline-none transition hover:border-[var(--color-primary-mid)] hover:bg-[var(--color-primary-light)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <AvatarImg url={avatarUrl} size="lg" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-ink)]">
          {displayName}
        </span>
      </button>
      {open ? panel : null}
    </div>
  );
}
