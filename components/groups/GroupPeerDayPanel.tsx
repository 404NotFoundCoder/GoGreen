"use client";

import { ChecklistRow } from "@/components/checklist/ChecklistRow";
import { ChecklistStampCard } from "@/components/checklist/ChecklistStampCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStreakTierBonus } from "@/constants/scoring";
import { fetchGroupPeerDaySnapshot } from "@/lib/supabase/groupRecords";
import { Flame, Leaf } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  groupId: string;
  peerUserId: string;
  date: string;
};

export function GroupPeerDayPanel({ groupId, peerUserId, date }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [snap, setSnap] = useState<Awaited<
    ReturnType<typeof fetchGroupPeerDaySnapshot>
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void fetchGroupPeerDaySnapshot(groupId, peerUserId, date)
      .then((d) => {
        if (!cancelled) setSnap(d);
      })
      .catch((e) => {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, peerUserId, date]);

  const totalSlots = useMemo(() => {
    if (!snap) return 0;
    return snap.items.length + snap.customItems.length;
  }, [snap]);

  const doneCount = useMemo(() => {
    if (!snap) return 0;
    let n = 0;
    for (const i of snap.items) {
      if (snap.checkinItemIds.has(i.id)) n += 1;
    }
    for (const c of snap.customItems) {
      if (snap.checkinCustomIds.has(c.id)) n += 1;
    }
    return n;
  }, [snap]);

  const progressPct =
    totalSlots > 0 ? Math.min(100, (doneCount / totalSlots) * 100) : 0;
  const stats = snap?.stats;
  const allDone = totalSlots > 0 && doneCount >= totalSlots;

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (err) {
    return (
      <p className="py-2 text-xs text-amber-800">
        無法載入：{err}（請套用 `20260322310000_group_records_rpcs.sql`）
      </p>
    );
  }

  if (!snap) {
    return (
      <p className="py-2 text-xs text-[var(--color-subtle)]">無資料</p>
    );
  }

  return (
    <div className="min-w-0 space-y-3 border-t border-[var(--color-muted)]/50 pt-3 first:border-0 first:pt-0">
      <div className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] p-3 sm:p-4">
        <p className="text-[11px] leading-snug text-[var(--color-ink-secondary)]">
          日期 (UTC+8) {date}
        </p>
        {stats ? (
          <>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--color-ink-secondary)]">
                  進度
                </dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[var(--color-ink)]">
                  {doneCount}/{totalSlots || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--color-ink-secondary)]">
                  當日得分
                </dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[var(--color-ink)]">
                  {stats.raw_score}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] text-[var(--color-ink-secondary)]">
                  連續天數
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
                  <span className="text-lg font-bold tabular-nums text-[var(--color-ink)]">
                    {stats.streak}天
                  </span>
                  <Flame
                    className="h-4 w-4 shrink-0 text-[#ea580c]"
                    aria-hidden
                  />
                  {getStreakTierBonus(stats.streak) > 0 ? (
                    <span className="gg-tier-badge inline-flex min-h-[20px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                      🔥 +{getStreakTierBonus(stats.streak)}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-[#CFD5BD]">
                <div
                  className="h-full rounded-[3px] bg-[#87986A]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-[var(--color-subtle)]">
            當日尚無統計列（可能僅部分打卡）
          </p>
        )}
      </div>

      {totalSlots === 0 ? (
        <p className="text-xs text-[var(--color-subtle)]">當日清單為空</p>
      ) : (
        <>
          <h3 className="text-[11px] font-medium tracking-[0.08em] text-[var(--color-ink-secondary)] uppercase">
            行動清單（唯讀）
          </h3>
          <div className="space-y-2">
            {snap.items.map((item) => (
              <div key={item.id}>
                <ChecklistRow
                  item={item}
                  done={snap.checkinItemIds.has(item.id)}
                  readOnly
                  disabled
                  onToggle={() => {}}
                  photoUrl={snap.photoByItemId[item.id] ?? null}
                />
              </div>
            ))}
            {snap.customItems.map((item) => (
              <div key={item.id}>
                <ChecklistStampCard
                  done={snap.checkinCustomIds.has(item.id)}
                  readOnly
                  disabled
                  onToggle={() => {}}
                  title={item.title}
                  metaLine={
                    <span>
                      自訂 · {item.is_favorite ? "已收藏" : "今日項目"}
                    </span>
                  }
                  sdgIds={item.sdg_ids ?? undefined}
                  photoUrl={snap.photoByCustomId[item.id] ?? null}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {allDone && totalSlots > 0 ? (
        <div
          className="rounded-xl border-[0.5px] border-[var(--color-primary-dark)]/40 bg-[var(--color-primary-light)]/50 px-3 py-2 text-center text-sm text-[var(--color-primary-dark)]"
          role="status"
        >
          <span className="inline-flex items-center justify-center gap-1 font-medium">
            <Leaf className="h-4 w-4" strokeWidth={2} aria-hidden />
            當日清單全完成
          </span>
        </div>
      ) : null}
    </div>
  );
}
