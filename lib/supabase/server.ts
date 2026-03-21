import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !key) {
    throw new Error(
      [
        "[GoGreen] 缺少環境變數：請在專案根目錄 .env.local 設定",
        "NEXT_PUBLIC_SUPABASE_URL（完整 https://…supabase.co）與",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY（Supabase Dashboard → Settings → API 的 anon public，長 JWT）",
        "存檔後重新執行 npm run dev。",
      ].join(" "),
    );
  }

  if (!url.startsWith("http")) {
    throw new Error(
      "[GoGreen] NEXT_PUBLIC_SUPABASE_URL 必須是完整網址，例如 https://xxxx.supabase.co（不可只有單一字母或佔位字）",
    );
  }

  return { url, key };
}

export async function createClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Component 無法 set cookie 時略過 */
        }
      },
    },
  });
}
