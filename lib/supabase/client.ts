import { createBrowserClient } from "@supabase/ssr";

function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY，請檢查 .env.local",
    );
  }
  if (!url.startsWith("http")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 必須是完整 https://…supabase.co",
    );
  }
  return { url, key };
}

export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}
