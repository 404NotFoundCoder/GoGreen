import { DEFAULT_TEMPLATE_ID } from "@/constants/checklist";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode } from "@/lib/utils/invite";

export async function listMyGroups(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select(
      "group_id, joined_at, groups ( id, name, description, is_public, invite_code, template_id, created_at )",
    )
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function listPublicGroups() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, is_public, invite_code, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(args: {
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
}) {
  const supabase = createClient();
  const inviteCode = args.isPublic ? null : generateInviteCode();

  const { data: g, error } = await supabase
    .from("groups")
    .insert({
      name: args.name.trim(),
      description: args.description?.trim() || null,
      is_public: args.isPublic,
      invite_code: inviteCode,
      template_id: DEFAULT_TEMPLATE_ID,
      created_by: args.userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: e2 } = await supabase.from("group_members").insert({
    group_id: g!.id,
    user_id: args.userId,
  });
  if (e2) throw e2;

  return { groupId: g!.id as string, inviteCode };
}

export async function joinPublicGroupRpc(groupId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("join_public_group", {
    p_group_id: groupId,
  });
  if (error) throw error;
}

export async function joinPrivateGroupRpc(code: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_private_group", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return data as string;
}

export async function leaveGroup(groupId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}
