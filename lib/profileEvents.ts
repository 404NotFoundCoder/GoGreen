/** 個人資料（暱稱等）更新後，通知導覽列等處重新讀取 */
export const PROFILE_REFRESH_EVENT = "go-green-profile-refresh";

export function dispatchProfileRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROFILE_REFRESH_EVENT));
}
