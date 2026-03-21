"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { INVITE_CODE_LENGTH } from "@/constants/config";
import { useGroups } from "@/hooks/useGroups";
import { translateGroupRpcError } from "@/lib/utils/groupErrors";
import { useEffect, useMemo, useState } from "react";

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
    sendEmailInvite,
    respondInvite,
  } = useGroups();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [respondBusyId, setRespondBusyId] = useState<string | null>(null);

  const createdGroups = useMemo(() => {
    if (!userId) return [];
    return mine
      .map(parseNestedGroup)
      .filter(
        (g): g is NestedGroup =>
          g !== null && g.created_by === userId,
      );
  }, [mine, userId]);

  useEffect(() => {
    if (!inviteGroupId && createdGroups.length > 0) {
      setInviteGroupId(createdGroups[0]!.id);
    }
    if (
      inviteGroupId &&
      !createdGroups.some((g) => g.id === inviteGroupId)
    ) {
      setInviteGroupId(createdGroups[0]?.id ?? "");
    }
  }, [createdGroups, inviteGroupId]);

  const onCreate = async () => {
    setBusy(true);
    setMsg(null);
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
        setMsg(`已建立私人群組，邀請碼：${inviteCode}`);
      } else {
        setMsg("已建立群組");
      }
    } catch (e) {
      setMsg(translateGroupRpcError(e));
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
    return (
      <p className="text-[var(--color-ink)]">{error.message}</p>
    );
  }

  return (
    <div className="space-y-10">
      {pendingInvites.length > 0 ? (
        <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            待處理的群組邀請
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            僅在<strong>登入信箱與受邀信箱一致</strong>時可加入。你可選擇接受或拒絕。
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
                    disabled={respondBusyId === inv.id}
                    className="min-h-[44px] rounded-full bg-[var(--color-primary-strong)] px-4 py-2 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
                    onClick={() => {
                      setRespondBusyId(inv.id);
                      void respondInvite(inv.id, true)
                        .catch((e) =>
                          setJoinMsg(translateGroupRpcError(e)),
                        )
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
                        .catch((e) =>
                          setJoinMsg(translateGroupRpcError(e)),
                        )
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

      {joinMsg ? (
        <p className="text-sm text-[var(--color-primary-dark)]">{joinMsg}</p>
      ) : null}

      <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          建立群組
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          <strong>公開</strong>：任何人都可在下方清單搜尋並加入。
          <strong> 私人</strong>：需 6 碼邀請碼或以信箱邀請；不會出現在公開清單。
        </p>
        <input
          className="mt-3 w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5"
          placeholder="群組名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="mt-2 w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5"
          placeholder="簡介（選填）"
          rows={2}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm text-[var(--color-ink-secondary)]">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-5 w-5 accent-[var(--color-primary-strong)]"
          />
          公開群組（取消勾選＝私人）
        </label>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void onCreate()}
          className="mt-3 min-h-[44px] w-full rounded-full bg-[var(--color-primary-strong)] px-4 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
        >
          {busy ? "建立中…" : "建立"}
        </button>
        {msg ? (
          <p className="mt-2 text-sm text-[var(--color-primary-dark)]">{msg}</p>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          以邀請碼加入（私人）
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">
          請向建立者索取 {INVITE_CODE_LENGTH} 碼英數邀請碼。
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="min-h-[44px] flex-1 rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 font-mono uppercase tracking-wider"
            placeholder={`${INVITE_CODE_LENGTH} 碼邀請碼`}
            maxLength={INVITE_CODE_LENGTH}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
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
            disabled={pending === "private-join" || code.length !== INVITE_CODE_LENGTH}
            className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => {
              setPending("private-join");
              setJoinMsg(null);
              void joinPrivate(code)
                .then(() => {
                  setCode("");
                  setJoinMsg("已以邀請碼加入私人群組");
                })
                .catch((e) => setJoinMsg(translateGroupRpcError(e)))
                .finally(() => setPending(null));
            }}
          >
            {pending === "private-join" ? "加入中…" : "加入私人"}
          </button>
        </div>
      </section>

      {createdGroups.length > 0 ? (
        <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">
            以信箱邀請成員
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            輸入對方的<strong> Google 登入信箱</strong>。對方須在「待處理的群組邀請」接受後才會加入；信箱須與其登入帳號一致。
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-[var(--color-ink-secondary)]">
              選擇你建立的群組
              <select
                value={inviteGroupId}
                onChange={(e) => setInviteGroupId(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5 text-[var(--color-ink)]"
              >
                {createdGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.is_public ? "（公開）" : "（私人）"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-[var(--color-ink-secondary)]">
              對方信箱
              <input
                type="email"
                autoComplete="email"
                placeholder="name@gmail.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 py-2.5"
              />
            </label>
            <button
              type="button"
              disabled={
                inviteBusy ||
                !inviteGroupId ||
                !inviteEmail.trim().includes("@")
              }
              onClick={() => {
                setInviteBusy(true);
                setInviteMsg(null);
                void sendEmailInvite(inviteGroupId, inviteEmail.trim())
                  .then(() => {
                    setInviteEmail("");
                    setInviteMsg("已發送邀請");
                  })
                  .catch((e) => setInviteMsg(translateGroupRpcError(e)))
                  .finally(() => setInviteBusy(false));
              }}
              className="min-h-[44px] shrink-0 rounded-full bg-[var(--color-primary-strong)] px-5 py-2.5 text-sm font-medium text-[var(--color-white)] disabled:opacity-50"
            >
              {inviteBusy ? "送出中…" : "發送邀請"}
            </button>
          </div>
          {inviteMsg ? (
            <p className="mt-2 text-sm text-[var(--color-primary-dark)]">
              {inviteMsg}
            </p>
          ) : null}
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
              return (
                <li
                  key={row.group_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">
                      {g.name}
                    </p>
                    <p className="text-xs text-[var(--color-ink-secondary)]">
                      {g.is_public ? "公開" : "私人"}
                      {!g.is_public && g.invite_code
                        ? ` · 邀請碼 ${g.invite_code}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending === `leave:${g.id}`}
                    className="min-h-[44px] rounded-full px-3 text-sm text-red-800 disabled:opacity-50"
                    onClick={() => {
                      setPending(`leave:${g.id}`);
                      void leave(g.id).finally(() => setPending(null));
                    }}
                  >
                    {pending === `leave:${g.id}` ? "退出中…" : "退出"}
                  </button>
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
            {publicList.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{g.name}</p>
                  {g.description ? (
                    <p className="text-sm text-[var(--color-ink-secondary)]">
                      {g.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={pending === `join:${g.id}`}
                  className="min-h-[44px] rounded-full bg-[var(--color-primary-pale)] px-4 py-2 text-sm font-medium text-[var(--color-primary-dark)] disabled:opacity-50"
                  onClick={() => {
                    setPending(`join:${g.id}`);
                    setJoinMsg(null);
                    void joinPublic(g.id)
                      .then(() =>
                        setJoinMsg(`已加入「${g.name}」`),
                      )
                      .catch((e) =>
                        setJoinMsg(translateGroupRpcError(e)),
                      )
                      .finally(() => setPending(null));
                  }}
                >
                  {pending === `join:${g.id}` ? "加入中…" : "加入"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
