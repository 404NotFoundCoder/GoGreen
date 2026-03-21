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
  const { user } = useAuthContext();
  const [mine, setMine] = useState<Awaited<ReturnType<typeof listMyGroups>>>(
    [],
  );
  const [publicList, setPublicList] = useState<
    Awaited<ReturnType<typeof listPublicGroups>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const joinPublic = async (groupId: string) => {
    if (!user) return;
    await joinPublicGroupRpc(groupId);
    await load();
  };

  const joinPrivate = async (code: string) => {
    if (!user) return;
    await joinPrivateGroupRpc(code);
    await load();
  };

  const createGroupAction = async (args: {
    name: string;
    description?: string;
    isPublic: boolean;
  }) => {
    if (!user) return undefined;
    const result = await createGroup({ userId: user.id, ...args });
    await load();
    return result;
  };

  const leave = async (groupId: string) => {
    if (!user) return;
    await leaveGroup(groupId, user.id);
    await load();
  };

  return {
    mine,
    publicList,
    loading,
    error,
    refetch: load,
    joinPublic,
    joinPrivate,
    createGroup: createGroupAction,
    leave,
  };
}
