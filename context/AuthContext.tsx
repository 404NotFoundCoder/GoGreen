"use client";

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    try {
      const supabase = createClient();
      void supabase.auth.getSession().then(({ data }) => {
        if (!cancelled) {
          setUser(data.session?.user ?? null);
          setLoading(false);
        }
      });
      subscription = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      }).data.subscription;
    } catch {
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext 需在 AuthProvider 內使用");
  }
  return ctx;
}
