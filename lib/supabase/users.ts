import { createClient } from "@/lib/supabase/client";

export type UserProfileRow = {
  id: string;
  nickname: string;
  email: string | null;
  photo_url: string | null;
  created_at: string;
  onboarding_completed: boolean;
};

export async function fetchProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, nickname, email, photo_url, created_at, onboarding_completed",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfileRow | null;
}

export async function updateNickname(userId: string, nickname: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ nickname: nickname.trim() })
    .eq("id", userId);
  if (error) throw error;
}

/** 首次登入暱稱確認（完成後不再顯示引導） */
export async function completeNicknameOnboarding(
  userId: string,
  nickname: string,
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({
      nickname: nickname.trim(),
      onboarding_completed: true,
    })
    .eq("id", userId);
  if (error) throw error;
}
