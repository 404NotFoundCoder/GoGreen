"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useGroups } from "@/hooks/useGroups";
import { useState } from "react";

export function GroupHub() {
  const {
    mine,
    publicList,
    loading,
    error,
    joinPublic,
    joinPrivate,
    createGroup,
    leave,
  } = useGroups();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
      setMsg(e instanceof Error ? e.message : "建立失敗");
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
      <section className="rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] p-4">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          建立群組
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
          公開群組任何人都可搜尋加入；私人群組需邀請碼。
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
          公開群組
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
          以邀請碼加入
        </h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="min-h-[44px] flex-1 rounded-lg border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)] px-3 uppercase"
            placeholder="6 碼邀請碼"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            disabled={pending === "private-join"}
            className="min-h-[44px] rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => {
              setPending("private-join");
              void joinPrivate(code)
                .catch(console.error)
                .finally(() => setPending(null));
            }}
          >
            {pending === "private-join" ? "加入中…" : "加入私人"}
          </button>
        </div>
      </section>

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
              const raw = row.groups as unknown;
              const g = (
                Array.isArray(raw) ? raw[0] : raw
              ) as {
                id: string;
                name: string;
                is_public: boolean;
                invite_code: string | null;
              } | null;
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
                    void joinPublic(g.id).finally(() => setPending(null));
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
