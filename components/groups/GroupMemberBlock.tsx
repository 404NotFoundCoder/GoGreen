"use client";

import { RemoveGroupMemberDialog } from "@/components/groups/RemoveGroupMemberDialog";
import { useToast } from "@/context/ToastContext";
import {
  fetchGroupMemberCount,
  fetchGroupMembersPreview,
  type GroupMemberPreviewRow,
} from "@/lib/supabase/groups";
import { translateGroupRpcError } from "@/lib/utils/groupErrors";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

function MemberAvatar({
  nickname,
  photoUrl,
}: {
  nickname: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full object-cover shadow-[0_1px_3px_rgba(45,52,40,0.12)] ring-2 ring-[var(--color-white)]"
        referrerPolicy="no-referrer"
      />
    );
  }
  const t = nickname.trim();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary-pale)] to-[#c4d4b0] text-sm font-semibold text-[var(--color-primary-dark)] shadow-[0_1px_3px_rgba(45,52,40,0.1)] ring-2 ring-[var(--color-white)]">
      {t ? t.slice(0, 1) : "?"}
    </div>
  );
}

type Props = {
  groupId: string;
  isOwner: boolean;
  viewerUserId: string | null;
  onRemoveMember: (groupId: string, targetUserId: string) => Promise<void>;
};

export function GroupMemberBlock({
  groupId,
  isOwner,
  viewerUserId,
  onRemoveMember,
}: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMemberPreviewRow[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchGroupMemberCount(groupId)
      .then((c) => {
        if (!cancelled) setCount(c);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    if (!open) return;
    if (members !== null) return;
    let cancelled = false;
    void fetchGroupMembersPreview(groupId)
      .then((rows) => {
        if (!cancelled) {
          setMembers(rows);
          setLoadErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setMembers([]);
          setLoadErr(translateGroupRpcError(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, groupId, members]);

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const { userId: targetUserId, name: removedName } = removeTarget;
    setRemoving(targetUserId);
    try {
      await onRemoveMember(groupId, targetUserId);
      setRemoveTarget(null);
      setMembers(null);
      const c = await fetchGroupMemberCount(groupId);
      setCount(c);
      toast.show(`已將「${removedName}」移出群組`);
    } catch (e) {
      toast.show(translateGroupRpcError(e));
    } finally {
      setRemoving(null);
    }
  };

  const countLabel =
    count === null ? "—" : `${count} 人`;

  return (
    <div className="mt-2 w-full min-w-0">
      <button
        type="button"
        className="flex w-full max-w-full items-center gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-4 py-3 text-left shadow-[0_1px_2px_rgba(45,52,40,0.04)] transition hover:border-[var(--color-primary-strong)]/25 hover:shadow-[0_4px_12px_rgba(45,52,40,0.06)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-[var(--color-ink)]">
          成員
        </span>
        <span className="rounded-full bg-[var(--color-primary-light)]/80 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary-dark)]">
          {countLabel}
        </span>
        <ChevronDown
          className={[
            "ml-auto h-5 w-5 shrink-0 text-[var(--color-primary-strong)]/60 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-primary-light)]/15 p-3 shadow-inner">
          <ul className="space-y-2">
            {loadErr ? (
              <li className="rounded-xl bg-[var(--color-white)]/80 px-3 py-2 text-xs text-[var(--color-ink-secondary)]">
                {loadErr}
              </li>
            ) : members === null ? (
              <li className="rounded-xl bg-[var(--color-white)]/80 px-3 py-4 text-center text-sm text-[var(--color-ink-secondary)]">
                載入中…
              </li>
            ) : members.length === 0 ? (
              <li className="rounded-xl bg-[var(--color-white)]/80 px-3 py-3 text-sm text-[var(--color-ink-secondary)]">
                尚無法顯示成員（私人群組僅成員可見名單）。
              </li>
            ) : (
              members.map((m) => {
                const name = m.nickname?.trim() || "使用者";
                const canRemove =
                  isOwner &&
                  viewerUserId &&
                  m.user_id !== viewerUserId;
                return (
                  <li key={m.user_id}>
                    <div className="flex items-center gap-3 rounded-xl border-[0.5px] border-[var(--color-muted)]/70 bg-[var(--color-white)] px-3 py-2.5 shadow-sm">
                      <MemberAvatar nickname={name} photoUrl={m.photo_url} />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
                        {name}
                      </span>
                      {canRemove ? (
                        <button
                          type="button"
                          disabled={
                            removing === m.user_id || removeTarget !== null
                          }
                          className="shrink-0 rounded-full border-[0.5px] border-[#fecaca] bg-[#fef2f2] px-3 py-1.5 text-xs font-semibold text-[#991b1b] transition hover:bg-[#fee2e2] disabled:opacity-50"
                          onClick={() =>
                            setRemoveTarget({
                              userId: m.user_id,
                              name,
                            })
                          }
                        >
                          剔除
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}

      <RemoveGroupMemberDialog
        open={removeTarget !== null}
        memberName={removeTarget?.name ?? ""}
        busy={removing !== null}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
