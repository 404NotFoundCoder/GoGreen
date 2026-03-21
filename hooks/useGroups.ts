"use client";

import {
  createGroup,
  createGroupEmailInvites,
  deleteGroup,
  joinPrivateGroupRpc,
  joinPublicGroupRpc,
  leaveGroup,
  listMyGroups,
  listPendingGroupInvites,
  listPublicGroups,
  respondGroupEmailInvite,
  type PendingGroupInviteRow,
} from "@/lib/supabase/groups";
import { useAuthContext } from "@/context/AuthContext";
import { toErrorMessage } from "@/lib/utils/error";
import { useCallback, useEffect, useState } from "react";

export function useGroups() {
  const { user, loading: authLoading } = useAuthContext();
  const [mine, setMine] = useState<Awaited<ReturnType<typeof listMyGroups>>>(
    [],
  );
  const [publicList, setPublicList] = useState<
    Awaited<ReturnType<typeof listPublicGroups>>
  >([]);
  const [pendingInvites, setPendingInvites] = useState<PendingGroupInviteRow[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) {
        if (!opts?.silent) setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const [m, p, invites] = await Promise.all([
          listMyGroups(user.id),
          listPublicGroups(),
          listPendingGroupInvites().catch(() => [] as PendingGroupInviteRow[]),
        ]);
        setMine(m);
        setPublicList(p);
        setPendingInvites(invites);
      } catch (e) {
        setError(new Error(toErrorMessage(e)));
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [load, authLoading]);

  const joinPublic = async (groupId: string) => {
    if (!user) return;
    await joinPublicGroupRpc(groupId);
    await load({ silent: true });
  };

  const joinPrivate = async (code: string) => {
    if (!user) return;
    await joinPrivateGroupRpc(code);
    await load({ silent: true });
  };

  const createGroupAction = async (args: {
    name: string;
    description?: string;
    isPublic: boolean;
  }) => {
    if (!user) return undefined;
    const result = await createGroup({ userId: user.id, ...args });
    await load({ silent: true });
    return result;
  };

  const leave = async (groupId: string) => {
    if (!user) return;
    await leaveGroup(groupId, user.id);
    await load({ silent: true });
  };

  const sendEmailInvites = async (groupId: string, raw: string) => {
    if (!user) return { sent: 0, failed: [] as { email: string; message: string }[] };
    const r = await createGroupEmailInvites(groupId, raw);
    await load({ silent: true });
    return r;
  };

  const respondInvite = async (inviteId: string, accept: boolean) => {
    if (!user) return;
    await respondGroupEmailInvite(inviteId, accept);
    await load({ silent: true });
  };

  const removeGroup = async (groupId: string) => {
    if (!user) return;
    await deleteGroup(groupId);
    await load({ silent: true });
  };

  return {
    mine,
    publicList,
    pendingInvites,
    userId: user?.id ?? null,
    loading: loading || authLoading,
    error,
    refetch: load,
    joinPublic,
    joinPrivate,
    createGroup: createGroupAction,
    leave,
    sendEmailInvites,
    respondInvite,
    deleteGroup: removeGroup,
  };
}
