"use client";

import { fetchProfile } from "@/lib/supabase/users";
import { PROFILE_REFRESH_EVENT } from "@/lib/profileEvents";
import { useAuthContext } from "@/context/AuthContext";
import { useCallback, useEffect, useState } from "react";

/**
 * 導覽列顯示用：優先使用 public.users.nickname
 */
export function useProfileNickname() {
  const { user, loading: authLoading } = useAuthContext();
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setNickname(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchProfile(user.id);
      setNickname(row?.nickname?.trim() ?? null);
    } catch {
      setNickname(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(PROFILE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PROFILE_REFRESH_EVENT, onRefresh);
  }, [load]);

  return { nickname, loading: loading || authLoading, refresh: load };
}
