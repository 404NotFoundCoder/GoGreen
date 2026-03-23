"use client";

import { DeleteGroupDialog } from "@/components/groups/DeleteGroupDialog";
import { GroupMemberBlock } from "@/components/groups/GroupMemberBlock";
import { EmailChipsInput } from "@/components/ui/EmailChipsInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { INVITE_CODE_LENGTH } from "@/constants/config";
import { useToast } from "@/context/ToastContext";
import { useGroups } from "@/hooks/useGroups";
import { translateGroupRpcError } from "@/lib/utils/groupErrors";
import { ChevronDown, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** 私人群邀請碼：固定顯示＋複製（不依賴收合） */
function InviteCodePanel({ code }: { code: string }) {
  const toast = useToast();
  return (
    <div className="mt-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-gradient-to-br from-[var(--color-primary-light)]/55 via-[var(--color-white)] to-[var(--color-surface)] px-4 py-3 shadow-[0_2px_8px_rgba(45,52,40,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-secondary)]">
            邀請碼（私人）
          </p>
          <p className="mt-1 break-all font-mono text-lg font-bold tracking-[0.28em] text-[var(--color-ink)] sm:text-xl">
            {code}
          </p>
        </div>
        <button
          type="button"
          className="min-h-[44px] shrink-0 rounded-full bg-[var(--color-primary-strong)] px-6 py-2.5 text-sm font-semibold text-[var(--color-white)] shadow-sm transition hover:opacity-95 active:scale-[0.98]"
          onClick={() => {
            void navigator.clipboard
              .writeText(code)
              .then(() => toast.show("已複製邀請碼"));
          }}
        >
          複製邀請碼
        </button>
      </div>
    </div>
  );
}

type NestedGroup = {
  id: string;
  name: string;
  is_public: boolean;
  invite_code: string | null;
  created_by: string | null;
};

function parseNestedGroup(row: { groups: unknown }): NestedGroup | null {
  const raw = row.groups as unknown;
  const g = (Array.isArray(raw) ? raw[0] : raw) as NestedGroup | null;
  return g;
}

export function GroupHub() {
  const toast = useToast();
  const {
    mine,
    publicList,
    pendingInvites,
    userId,
    loading,
    error,
    joinPublic,
    joinPrivate,
    createGroup,
    leave,
    sendEmailInvites,
    respondInvite,
    deleteGroup,
    removeMember,
  } = useGroups();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteDetail, setInviteDetail] = useState<string | null>(null);
  const [respondBusyId, setRespondBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  /** 已達一人一群時，預設收合鎖定區塊，僅顯示鎖頭＋提示 */
  const [lockedCreateExpanded, setLockedCreateExpanded] = useState(false);
  const [lockedInviteExpanded, setLockedInviteExpanded] = useState(false);
  /** 建立私人後顯示於「建立群組」下方之邀請碼區塊（與以邀請碼加入區之 toggle 同構） */
  const [createdPrivateCode, setCreatedPrivateCode] = useState<string | null>(
    null,
  );

  const atGroupLimit = mine.length >= 1;

  useEffect(() => {
    if (!atGroupLimit) {
      setLockedCreateExpanded(false);
      setLockedInviteExpanded(false);
    }
  }, [atGroupLimit]);

  const createdGroups = useMemo(() => {
    if (!userId) return [];
    return mine
      .map(parseNestedGroup)
      .filter((g): g is NestedGroup => g !== null && g.created_by === userId);
  }, [mine, userId]);

  const joinedGroupIds = useMemo(() => {
    const s = new Set<string>();
    for (const row of mine) {
      const g = parseNestedGroup(row);
      if (g?.id) s.add(g.id);
    }
    return s;
  }, [mine]);

  useEffect(() => {
    if (!inviteGroupId && createdGroups.length > 0) {
      setInviteGroupId(createdGroups[0]!.id);
    }
    if (inviteGroupId && !createdGroups.some((g) => g.id === inviteGroupId)) {
      setInviteGroupId(createdGroups[0]?.id ?? "");
    }
  }, [createdGroups, inviteGroupId]);

  const onCreate = async () => {
    if (atGroupLimit) return;
    setBusy(true);
    try {
      const result = await createGroup({
        name,
        description: desc || undefined,
        isPublic,
      });
      const inviteCode = result?.inviteCode;
      setName("");
      setDesc("");
      if (!isPublic && inviteCode) {
        setCreatedPrivateCode(inviteCode);
        void navigator.clipboard.writeText(inviteCode).catch(() => {});
        toast.show("已建立私人群組，邀請碼已複製到剪貼簿");
      } else {
        setCreatedPrivateCode(null);
        toast.show("已建立群組");
      }
    } catch (e) {
      toast.show(translateGroupRpcError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-[var(--color-ink)]">{error.message}</p>;
  }

  return (
    <div className="space-y-10">
      {atGroupLimit ? (
        <p className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-primary-light)] px-4 py-3 text-sm leading-relaxed text-[var(--color-ink)]">
          你已加入一個群組；每人僅能隸屬一個群組。若要建立、加入其他群組或接受新邀請，請先於「我的群組」
          <strong>退出</strong>目前群組。
        </p>
      ) : null}

      {pendingInvites.length > 0 ? (
        <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            待處理的群組邀請
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            僅在<strong>登入信箱與受邀信箱一致</strong>
            時可加入。你可選擇接受或拒絕。
          </p>
          <ul className="mt-3 space-y-3">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-3 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[var(--color-ink)]">
                    {inv.group_name}
                  </p>
                  <p className="text-xs text-[var(--color-ink-secondary)]">
                    邀請寄至：{inv.invited_email}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={respondBusyId === inv.id || atGroupLimit}
                    className="min-h-[44px] rounded-full bg-[var(--color-primary-strong)] px-4 py-2 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
                    title={
                      atGroupLimit ? "請先退出目前群組再接受邀請" : undefined
                    }
                    onClick={() => {
                      setRespondBusyId(inv.id);
                      void respondInvite(inv.id, true)
                        .then(() => {
                          toast.show(`已加入「${inv.group_name}」`);
                        })
                        .catch((e) => toast.show(translateGroupRpcError(e)))
                        .finally(() => setRespondBusyId(null));
                    }}
                  >
                    {respondBusyId === inv.id ? "處理中…" : "接受加入"}
                  </button>
                  <button
                    type="button"
                    disabled={respondBusyId === inv.id}
                    className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium disabled:opacity-50"
                    onClick={() => {
                      setRespondBusyId(inv.id);
                      void respondInvite(inv.id, false)
                        .then(() => toast.show("已拒絕邀請"))
                        .catch((e) => toast.show(translateGroupRpcError(e)))
                        .finally(() => setRespondBusyId(null));
                    }}
                  >
                    拒絕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className={[
          "overflow-hidden rounded-2xl border-[0.5px] bg-[var(--color-surface)] p-4",
          atGroupLimit
            ? "border-dashed border-[var(--color-muted)] bg-[var(--color-primary-light)]/35"
            : "border-[var(--color-muted)]",
        ].join(" ")}
      >
        {atGroupLimit ? (
          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-xl text-left transition hover:bg-[var(--color-white)]/40"
            onClick={() => setLockedCreateExpanded((v) => !v)}
            aria-expanded={lockedCreateExpanded}
            aria-controls="locked-create-form"
            id="locked-create-toggle"
          >
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)]/90 text-[var(--color-ink-secondary)] shadow-sm"
              aria-hidden
            >
              <Lock className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-lg font-semibold text-[var(--color-ink)]">
                  建立群組
                </span>
                <ChevronDown
                  className={[
                    "mt-0.5 h-5 w-5 shrink-0 text-[var(--color-ink-secondary)] transition-transform duration-200",
                    lockedCreateExpanded ? "rotate-180" : "",
                  ].join(" ")}
                  aria-hidden
                />
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[var(--color-ink-secondary)]">
                {lockedCreateExpanded
                  ? "以下表單已鎖定；若要建立新群組，請先於「我的群組」退出目前群組。點擊收合可隱藏。"
                  : "你已加入群組，無法再建立新群組。點擊展開可預覽表單（仍無法送出）。"}
              </span>
            </span>
          </button>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">
              建立群組
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
              <strong>公開</strong>：任何人都可在下方清單搜尋並加入。
              <strong> 私人</strong>：需 6
              碼邀請碼或以信箱邀請；不會出現在公開清單。
            </p>
          </>
        )}

        {!atGroupLimit || lockedCreateExpanded ? (
          <div
            id="locked-create-form"
            className={
              atGroupLimit
                ? "mt-4 border-t-[0.5px] border-[var(--color-muted)]/60 pt-4"
                : ""
            }
            role="region"
            aria-labelledby={atGroupLimit ? "locked-create-toggle" : undefined}
          >
            {atGroupLimit ? (
              <p className="text-sm leading-relaxed text-[var(--color-ink-secondary)]">
                <strong>公開</strong>：任何人都可在下方清單搜尋並加入。
                <strong> 私人</strong>：需 6
                碼邀請碼或以信箱邀請；不會出現在公開清單。 你已加入群組時
                <strong>無法</strong>再建立新群組。
              </p>
            ) : null}
            <input
              className="mt-3 w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="群組名稱"
              value={name}
              disabled={atGroupLimit}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="mt-2 w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="簡介（選填）"
              rows={2}
              value={desc}
              disabled={atGroupLimit}
              onChange={(e) => setDesc(e.target.value)}
            />
            <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm text-[var(--color-ink-secondary)]">
              <input
                type="checkbox"
                checked={isPublic}
                disabled={atGroupLimit}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              />
              公開群組（取消勾選＝私人）
            </label>
            <button
              type="button"
              disabled={busy || !name.trim() || atGroupLimit}
              onClick={() => void onCreate()}
              className="mt-3 min-h-[44px] w-full rounded-full bg-[var(--color-primary-strong)] px-4 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "建立中…" : "建立"}
            </button>
          </div>
        ) : null}
      </section>

      <section
        className={[
          "rounded-2xl border-[0.5px] p-4",
          atGroupLimit
            ? "border-dashed border-[var(--color-muted)] bg-[var(--color-primary-light)]/35"
            : "border-transparent",
        ].join(" ")}
      >
        {atGroupLimit ? (
          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-xl text-left transition hover:bg-[var(--color-white)]/40"
            onClick={() => setLockedInviteExpanded((v) => !v)}
            aria-expanded={lockedInviteExpanded}
            aria-controls="locked-invite-form"
            id="locked-invite-toggle"
          >
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)]/90 text-[var(--color-ink-secondary)] shadow-sm"
              aria-hidden
            >
              <Lock className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-lg font-semibold text-[var(--color-ink)]">
                  以邀請碼加入（私人）
                </span>
                <ChevronDown
                  className={[
                    "mt-0.5 h-5 w-5 shrink-0 text-[var(--color-ink-secondary)] transition-transform duration-200",
                    lockedInviteExpanded ? "rotate-180" : "",
                  ].join(" ")}
                  aria-hidden
                />
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[var(--color-ink-secondary)]">
                {lockedInviteExpanded
                  ? "以下欄位已鎖定；若以邀請碼加入他群，請先退出目前群組。點擊收合可隱藏。"
                  : "你已加入群組，無法再以邀請碼加入。點擊展開可預覽輸入區（仍無法送出）。"}
              </span>
            </span>
          </button>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">
              以邀請碼加入（私人）
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
              請向建立者索取 {INVITE_CODE_LENGTH} 碼英數邀請碼。
            </p>
          </>
        )}

        {!atGroupLimit || lockedInviteExpanded ? (
          <div
            id="locked-invite-form"
            className={
              atGroupLimit
                ? "mt-4 border-t-[0.5px] border-[var(--color-muted)]/60 pt-4"
                : ""
            }
            role="region"
            aria-labelledby={atGroupLimit ? "locked-invite-toggle" : undefined}
          >
            {atGroupLimit ? (
              <p className="text-sm text-[var(--color-ink-secondary)]">
                請向建立者索取 {INVITE_CODE_LENGTH} 碼英數邀請碼。{" "}
                你已加入群組時無法再以邀請碼加入其他群組。
              </p>
            ) : null}
            <div
              className={[
                "flex flex-col gap-2 sm:flex-row",
                atGroupLimit ? "mt-3" : "mt-2",
              ].join(" ")}
            >
              <input
                className="min-h-[44px] flex-1 rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 font-mono uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={`${INVITE_CODE_LENGTH} 碼邀請碼`}
                maxLength={INVITE_CODE_LENGTH}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                disabled={atGroupLimit}
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, INVITE_CODE_LENGTH),
                  )
                }
              />
              <button
                type="button"
                disabled={
                  pending === "private-join" ||
                  code.length !== INVITE_CODE_LENGTH ||
                  atGroupLimit
                }
                className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setPending("private-join");
                  void joinPrivate(code)
                    .then(() => {
                      setCode("");
                      toast.show("已以邀請碼加入私人群組");
                    })
                    .catch((e) => toast.show(translateGroupRpcError(e)))
                    .finally(() => setPending(null));
                }}
              >
                {pending === "private-join" ? "加入中…" : "加入私人"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {createdGroups.length > 0 ? (
        <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            以信箱邀請成員
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            輸入信箱後按 <strong>Enter</strong> 或 <strong>逗號</strong>
            可新增一筆；多筆會自動換行排列。亦可貼上多筆（逗號／換行皆可）。對方須在「待處理的群組邀請」接受；登入信箱須與受邀一致。
          </p>
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-medium text-[var(--color-ink)]">
              選擇你建立的群組
              <div className="relative mt-2">
                <select
                  value={inviteGroupId}
                  onChange={(e) => setInviteGroupId(e.target.value)}
                  className="min-h-[48px] w-full cursor-pointer appearance-none rounded-2xl border border-[var(--color-muted)] bg-[var(--color-white)] py-3 pl-4 pr-12 text-[15px] font-medium text-[var(--color-ink)] shadow-[0_1px_2px_rgba(45,52,40,0.06)] transition hover:border-[var(--color-primary-strong)]/45 hover:shadow-[0_4px_14px_rgba(45,52,40,0.08)] focus:border-[var(--color-primary-strong)]/55 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)]/25"
                >
                  {createdGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.is_public ? "（公開）" : "（私人）"}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-primary-strong)]/70"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
            </label>
            <label className="block text-sm font-medium text-[var(--color-ink)]">
              受邀信箱（可多名）
              <div className="mt-2">
                <EmailChipsInput
                  emails={inviteEmails}
                  onChange={setInviteEmails}
                  placeholder="輸入信箱後按 Enter 或逗號"
                />
              </div>
            </label>
            <button
              type="button"
              disabled={
                inviteBusy || !inviteGroupId || inviteEmails.length === 0
              }
              onClick={() => {
                setInviteBusy(true);
                setInviteDetail(null);
                void sendEmailInvites(inviteGroupId, inviteEmails.join("\n"))
                  .then((r) => {
                    if (r.sent > 0) {
                      toast.show(`已送出 ${r.sent} 筆邀請`);
                    }
                    if (r.failed.length > 0) {
                      toast.show(
                        `${r.failed.length} 筆未送出（可能重複或已是成員）`,
                      );
                      setInviteDetail(
                        r.failed
                          .map(
                            (f: { email: string; message: string }) =>
                              `${f.email}：${f.message}`,
                          )
                          .join("\n"),
                      );
                    }
                    if (r.sent > 0 && r.failed.length === 0) {
                      setInviteEmails([]);
                    }
                  })
                  .catch((e) => toast.show(translateGroupRpcError(e)))
                  .finally(() => setInviteBusy(false));
              }}
              className="min-h-[44px] w-full rounded-full bg-[var(--color-primary-strong)] px-5 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50 sm:w-auto"
            >
              {inviteBusy ? "送出中…" : "發送邀請"}
            </button>
            {inviteDetail ? (
              <pre className="whitespace-pre-wrap rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] p-3 text-xs text-[var(--color-ink-secondary)]">
                {inviteDetail}
              </pre>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          我的群組
        </h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-ink-secondary)]">
            尚未加入任何群組。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mine.map((row) => {
              const g = parseNestedGroup(row);
              if (!g) return null;
              const isCreator = Boolean(userId) && g.created_by === userId;
              return (
                <li
                  key={row.group_id}
                  className="flex flex-col gap-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-3"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--color-ink)]">
                          {g.name}
                        </p>
                        <p className="text-xs text-[var(--color-ink-secondary)]">
                          {isCreator ? "建立者 · " : null}
                          {g.is_public ? "公開" : "私人"}
                        </p>
                      </div>
                      <div className="flex shrink-0 justify-end gap-2">
                        {isCreator ? (
                          <button
                            type="button"
                            className="min-h-[44px] rounded-full border-[0.5px] border-[#b45309]/40 bg-[#fff7ed] px-4 text-sm font-medium text-[#9a3412] hover:bg-[#ffedd5]"
                            onClick={() =>
                              setDeleteTarget({ id: g.id, name: g.name })
                            }
                          >
                            刪除群組
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending === `leave:${g.id}`}
                            className="min-h-[44px] rounded-full px-3 text-sm text-red-800 disabled:opacity-50"
                            onClick={() => {
                              setPending(`leave:${g.id}`);
                              void leave(g.id)
                                .then(() => toast.show("已退出群組"))
                                .catch((e) =>
                                  toast.show(translateGroupRpcError(e)),
                                )
                                .finally(() => setPending(null));
                            }}
                          >
                            {pending === `leave:${g.id}` ? "退出中…" : "退出"}
                          </button>
                        )}
                      </div>
                    </div>
                    {g.is_public ? (
                      <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-secondary)]">
                        公開群組沒有邀請碼；請告知對方群組名稱，對方可在本頁下方「公開群組」清單加入。
                      </p>
                    ) : g.invite_code ? (
                      <InviteCodePanel code={g.invite_code} />
                    ) : null}
                    {userId ? (
                      <GroupMemberBlock
                        groupId={g.id}
                        isOwner={isCreator}
                        viewerUserId={userId}
                        onRemoveMember={removeMember}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          公開群組
        </h2>
        {publicList.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-ink-secondary)]">
            目前沒有公開群組。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {publicList.map((g) => {
              const alreadyJoined = joinedGroupIds.has(g.id);
              const blocked = atGroupLimit && !alreadyJoined;
              const isOwnerPublic =
                Boolean(userId) &&
                g.created_by != null &&
                g.created_by === userId;
              return (
                <li
                  key={g.id}
                  className="flex flex-col gap-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--color-ink)]">
                        {g.name}
                      </p>
                      {g.description ? (
                        <p className="text-sm text-[var(--color-ink-secondary)]">
                          {g.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {alreadyJoined ? (
                        <span
                          className="inline-flex min-h-[44px] items-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-4 py-2 text-sm font-medium text-[var(--color-ink-secondary)]"
                          aria-label="已加入此群組"
                        >
                          已加入
                        </span>
                      ) : blocked ? (
                        <span
                          className="inline-flex min-h-[44px] max-w-[11rem] items-center text-right text-sm leading-snug text-[var(--color-ink-secondary)]"
                          title="每人僅能隸屬一個群組"
                        >
                          已加入其他群組
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={pending === `join:${g.id}`}
                          className="min-h-[44px] rounded-full bg-[var(--color-primary-pale)] px-4 py-2 text-sm font-medium text-[var(--color-primary-dark)] disabled:opacity-50"
                          onClick={() => {
                            setPending(`join:${g.id}`);
                            void joinPublic(g.id)
                              .then(() => toast.show(`已加入「${g.name}」`))
                              .catch((e) =>
                                toast.show(translateGroupRpcError(e)),
                              )
                              .finally(() => setPending(null));
                          }}
                        >
                          {pending === `join:${g.id}` ? "加入中…" : "加入"}
                        </button>
                      )}
                    </div>
                  </div>
                  {userId ? (
                    <GroupMemberBlock
                      groupId={g.id}
                      isOwner={isOwnerPublic}
                      viewerUserId={userId}
                      onRemoveMember={removeMember}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DeleteGroupDialog
        open={deleteTarget !== null}
        groupName={deleteTarget?.name ?? ""}
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          setDeleteBusy(true);
          void deleteGroup(deleteTarget.id)
            .then(() => {
              toast.show(`已刪除群組「${deleteTarget.name}」`);
              setDeleteTarget(null);
            })
            .catch((e) => toast.show(translateGroupRpcError(e)))
            .finally(() => setDeleteBusy(false));
        }}
      />
    </div>
  );
}
