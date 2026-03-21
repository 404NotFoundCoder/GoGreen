"use client";

import { fetchProfile, updateNickname } from "@/lib/supabase/users";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

export function useProfile() {
  const { user, loading: authLoading } = useAuthContext();
  const [nickname, setNickname] = useState("");
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
      const row = await fetchProfile(user.id);
      setNickname(row?.nickname ?? "");
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [load, authLoading]);

  const save = async (next: string) => {
    if (!user) return;
    await updateNickname(user.id, next);
    await load();
  };

  return {
    nickname,
    setNickname,
    loading: loading || authLoading,
    error,
    save,
    refetch: load,
  };
}
