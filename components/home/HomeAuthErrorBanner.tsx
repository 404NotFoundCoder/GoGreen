"use client";

import { useSearchParams } from "next/navigation";

/** OAuth 失敗時 callback 導向 `/?error=auth`，於首頁顯示提示 */
export function HomeAuthErrorBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "auth") return null;

  return (
    <div
      className="border-b border-red-200/80 bg-red-50/95 px-4 py-3 text-center text-sm text-red-900"
      role="alert"
    >
      登入失敗，請重試。
    </div>
  );
}
