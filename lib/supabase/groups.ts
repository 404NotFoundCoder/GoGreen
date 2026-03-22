import { DEFAULT_TEMPLATE_ID } from "@/constants/checklist";
import { createClient } from "@/lib/supabase/client";
import { translateGroupRpcError } from "@/lib/utils/groupErrors";
import { parseInviteEmails } from "@/lib/utils/groupInvites";
import { generateInviteCode } from "@/lib/utils/invite";

export async function listMyGroups(userId: string) {
  const supabase = createClient();
  // 勿使用 group_members 嵌套 select groups：單一請求內會重入 RLS（g_select 的 EXISTS 再查 group_members → infinite recursion）
  const { data: rows, error } = await supabase
    .from("group_members")
    .select("group_id, joined_at")
    .eq("user_id", userId);
  if (error) throw error;
  const members = rows ?? [];
  if (members.length === 0) return [];

  const ids = [...new Set(members.map((r) => r.group_id))];
  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select(
      "id, name, description, is_public, invite_code, template_id, created_at, created_by",
    )
    .in("id", ids);
  if (gErr) throw gErr;

  const byId = new Map((groups ?? []).map((g) => [g.id as string, g]));
  return members.map((r) => ({
    group_id: r.group_id,
    joined_at: r.joined_at,
    groups: byId.get(r.group_id as string) ?? null,
  }));
}

export type PendingGroupInviteRow = {
  id: string;
  group_id: string;
  group_name: string;
  invited_email: string;
  created_at: string;
};

export async function listPendingGroupInvites() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_my_pending_group_invites");
  if (error) throw error;
  return (data ?? []) as PendingGroupInviteRow[];
}

export async function createGroupEmailInvite(groupId: string, email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_group_email_invite", {
    p_group_id: groupId,
    p_email: email,
  });
  if (error) throw error;
  return data as string;
}

export type EmailInviteBatchResult = {
  sent: number;
  failed: { email: string; message: string }[];
};

export async function createGroupEmailInvites(
  groupId: string,
  raw: string,
): Promise<EmailInviteBatchResult> {
  const emails = parseInviteEmails(raw);
  if (emails.length === 0) return { sent: 0, failed: [] };
  const failed: { email: string; message: string }[] = [];
  let sent = 0;
  for (const email of emails) {
    try {
      await createGroupEmailInvite(groupId, email);
      sent += 1;
    } catch (e) {
      failed.push({ email, message: translateGroupRpcError(e) });
    }
  }
  return { sent, failed };
}

export async function respondGroupEmailInvite(inviteId: string, accept: boolean) {
  const supabase = createClient();
  const { error } = await supabase.rpc("respond_group_email_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function listPublicGroups() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, description, is_public, invite_code, created_at, created_by",
    )
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
  const { count, error: cntErr } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", args.userId);
  if (cntErr) throw cntErr;
  if ((count ?? 0) > 0) {
    throw new Error("already_in_group");
  }

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

/** 僅建立者（RLS g_delete）可刪除；連帶 cascade 成員與邀請 */
export async function deleteGroup(groupId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

export type GroupMemberPreviewRow = {
  user_id: string;
  nickname: string | null;
  photo_url: string | null;
};

export async function fetchGroupMemberCount(groupId: string): Promise<number | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_group_member_count", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : null;
}

export async function fetchGroupMembersPreview(groupId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_group_members_preview", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return (data ?? []) as GroupMemberPreviewRow[];
}

export async function ownerRemoveGroupMember(groupId: string, targetUserId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("rpc_owner_remove_group_member", {
    p_group_id: groupId,
    p_user_id: targetUserId,
  });
  if (error) throw error;
}
