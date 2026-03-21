import { toErrorMessage } from "@/lib/utils/error";

/** 將 Supabase／Postgres RPC 錯誤轉成可讀中文（可讀時保留原文）。 */
export function translateGroupRpcError(e: unknown): string {
  const raw = toErrorMessage(e);
  const pairs: [string, string][] = [
    ["not_group_creator", "僅群組建立者可發送邀請"],
    ["invalid_email", "請輸入有效信箱"],
    ["already_invited", "已邀請過此信箱（待處理）"],
    ["already_member", "此信箱已是群組成員"],
    ["invalid_invite", "邀請不存在、已處理或邀請碼錯誤"],
    ["email_mismatch", "登入信箱與邀請不符，請使用受邀信箱登入"],
    ["no_email_in_session", "無法取得登入信箱，請確認以 Google 帳號登入"],
    ["not_public_or_missing", "找不到公開群組或無法加入"],
  ];
  const lower = raw.toLowerCase();
  for (const [k, v] of pairs) {
    if (lower.includes(k)) return v;
  }
  return raw;
}
