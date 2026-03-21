import { createClient } from "@/lib/supabase/client";

export async function fetchProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, nickname, email, photo_url, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateNickname(userId: string, nickname: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ nickname: nickname.trim() })
    .eq("id", userId);
  if (error) throw error;
}
