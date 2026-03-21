"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 已登入時導向 /today；無 Supabase 設定時靜默略過，不擋首頁 */
export function HomeAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    try {
      const supabase = createClient();
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) router.replace("/today");
      });
    } catch {
      /* 缺少或錯誤的環境變數：仍顯示首頁 */
    }
  }, [router]);

  return null;
}
