import { createClient } from "@/lib/supabase/client";

export async function fetchUserDayNote(
  userId: string,
  date: string,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_daily_notes")
    .select("note")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return (data?.note as string) ?? "";
}

export async function upsertUserDayNote(args: {
  userId: string;
  date: string;
  note: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("user_daily_notes").upsert(
    {
      user_id: args.userId,
      date: args.date,
      note: args.note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;
}
