"use client";

import type { CellParticipant } from "@/lib/supabase/leaderboardActionHeatmap";

type Props = {
  participants: CellParticipant[];
  photoTab: "list" | "gallery";
  loading: boolean;
  onOpenLightbox: (url: string) => void;
};

/** 全體榜／個人／群組「完成者」彈窗：清單列與照片牆（支援多張佐證） */
export function ActionCompletionParticipantEvidence({
  participants,
  photoTab,
  loading,
  onOpenLightbox,
}: Props) {
  if (loading) {
    return <p className="text-sm text-[var(--color-subtle)]">載入中…</p>;
  }

  if (photoTab === "list") {
    return (
      <ul className="space-y-2">
        {participants.length === 0 ? (
          <li className="text-sm text-[var(--color-subtle)]">無紀錄</li>
        ) : (
          participants.map((p) => (
            <li
              key={p.userId}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-muted)]/50 px-3 py-2"
            >
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-[var(--color-primary-pale)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-pale)] text-sm font-semibold text-[var(--color-primary-dark)]">
                  {(p.nickname || "?").trim().slice(0, 1) || "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--color-ink)]">
                  {p.nickname}
                </p>
                {p.photoUrls.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.photoUrls.map((url, i) => (
                      <button
                        key={`${p.userId}-ev-${i}`}
                        type="button"
                        onClick={() => onOpenLightbox(url)}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-muted)]/60 bg-[var(--color-white)] ring-[var(--color-primary)]/25 transition hover:ring-2"
                        title={`${p.nickname} 佐證 ${i + 1}/${p.photoUrls.length}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`${p.nickname} 佐證 ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[var(--color-subtle)]">
                    無佐證照片
                  </span>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    );
  }

  const tiles = participants.flatMap((p) =>
    p.photoUrls.map((url, i) => ({
      key: `${p.userId}-ph-${i}`,
      url,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
    })),
  );

  if (tiles.length === 0) {
    return (
      <p className="text-sm text-[var(--color-subtle)]">此日無佐證照片</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onOpenLightbox(t.url)}
          className="relative aspect-square overflow-hidden rounded-lg border border-[var(--color-muted)]/60 bg-[var(--color-white)]"
          title={t.nickname}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.url}
            alt={`${t.nickname} 佐證`}
            className="h-full w-full object-cover"
          />
          {t.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.avatarUrl}
              alt=""
              width={24}
              height={24}
              className="pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full border-2 border-white/95 object-cover shadow-md ring-1 ring-black/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="pointer-events-none absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/95 bg-[var(--color-primary-pale)] text-[10px] font-bold text-[var(--color-primary-dark)] shadow-md ring-1 ring-black/10"
              aria-hidden
            >
              {(t.nickname || "?").trim().slice(0, 1) || "?"}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
