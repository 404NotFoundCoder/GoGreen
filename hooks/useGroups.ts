"use client";

import {
  createGroup,
  joinPrivateGroupRpc,
  joinPublicGroupRpc,
  leaveGroup,
  listMyGroups,
  listPublicGroups,
} from "@/lib/supabase/groups";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export function useGroups() {
  const { user, loading: authLoading } = useAuthContext();
  const [mine, setMine] = useState<Awaited<ReturnType<typeof listMyGroups>>>(
    [],
  );
  const [publicList, setPublicList] = useState<
    Awaited<ReturnType<typeof listPublicGroups>>
  >([]);
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
        const [m, p] = await Promise.all([
          listMyGroups(user.id),
          listPublicGroups(),
        ]);
        setMine(m);
        setPublicList(p);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
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

  return {
    mine,
    publicList,
    loading: loading || authLoading,
    error,
    refetch: load,
    joinPublic,
    joinPrivate,
    createGroup: createGroupAction,
    leave,
  };
}
