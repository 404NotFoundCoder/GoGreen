"use client";

import { Leaf, Trophy, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/today", label: "今日", icon: Leaf },
  { href: "/leaderboard", label: "排行榜", icon: Trophy },
  { href: "/groups", label: "群組", icon: Users },
  { href: "/profile", label: "我", icon: User },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: (typeof NAV)[number]["icon"];
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={[
        "flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--color-primary-pale)] text-[var(--color-primary-dark)]"
          : "text-[var(--color-ink-secondary)] hover:bg-[var(--color-primary-light)]",
      ].join(" ")}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-bg)] lg:flex-row">
      <aside className="hidden border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:px-3 lg:py-6">
        <p className="mb-6 px-2 text-lg font-semibold text-[var(--color-ink)]">
          GoGreen
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-5xl lg:px-8 lg:py-10">
          {children}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-2 py-2 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </nav>
    </div>
  );
}
