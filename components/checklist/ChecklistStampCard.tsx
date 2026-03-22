"use client";

import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { SdgTag } from "@/components/ui/SdgTag";
import { MAX_CHECKIN_PHOTOS } from "@/constants/config";
import { Leaf, Pencil, Trash2, X, ZoomIn } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

const PARTICLE_COLORS = [
  "#87986A",
  "#B5C99A",
  "#CFE1B9",
  "#97A97C",
  "#718355",
];

function triggerSpring(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove("gg-stamp-spring");
  void el.offsetWidth;
  el.classList.add("gg-stamp-spring");
  const cleanup = () => {
    el.classList.remove("gg-stamp-spring");
    el.removeEventListener("animationend", onEnd);
    window.clearTimeout(fallback);
  };
  const onEnd = (e: AnimationEvent) => {
    if (e.animationName !== "spring") return;
    cleanup();
  };
  const fallback = window.setTimeout(cleanup, 400);
  el.addEventListener("animationend", onEnd);
}

/** 與參考 HTML 的 particleFly：--tx / --ty、隨機延遲與時長 */
function spawnParticles(stampEl: HTMLElement | null) {
  if (!stampEl || typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = stampEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 8; i++) {
    const div = document.createElement("div");
    div.className = "gg-stamp-particle-dot";
    const angle = (i / 8) * 360;
    const dist = 44 + Math.random() * 48;
    const tx = Math.cos((angle * Math.PI) / 180) * dist;
    const ty = Math.sin((angle * Math.PI) / 180) * dist;
    const size = 4 + Math.random() * 5;
    div.style.left = `${cx}px`;
    div.style.top = `${cy}px`;
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.background =
      PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
    div.style.setProperty("--tx", `${tx}px`);
    div.style.setProperty("--ty", `${ty}px`);
    div.style.animationDelay = `${Math.random() * 0.08}s`;
    div.style.animationDuration = `${0.32 + Math.random() * 0.16}s`;
    document.body.appendChild(div);
    window.setTimeout(() => div.remove(), 650);
  }
}

type Props = {
  done: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title: string;
  description?: string | null;
  metaLine?: ReactNode;
  sdgIds?: number[];
  /** SDG 標籤是否顯示中文標籤（預設顯示） */
  sdgShowLabel?: boolean;
  /** 已完成時可上傳佐證（最多 MAX_CHECKIN_PHOTOS） */
  photoUrls?: string[];
  onAddPhotos?: (files: File[]) => void | Promise<void>;
  onRemovePhoto?: (index: number) => void;
  photoUploadBusy?: boolean;
  /** 與 photoUploadBusy 併用：顯示百分比與階段說明 */
  photoUploadProgress?: { percent: number; message: string } | null;
  /** 自訂項目：從「今日」移除（不刪除收藏本體） */
  onRequestRemoveFromToday?: () => void;
  removeFromTodayPending?: boolean;
  /** 自訂項目：編輯標題／SDG（同一筆 custom_items） */
  onRequestEdit?: () => void;
  editPending?: boolean;
  /** 僅檢視：不可打卡、不套用 disabled 灰階，佐證仍可放大檢視 */
  readOnly?: boolean;
};

export function ChecklistStampCard({
  done,
  disabled,
  onToggle,
  title,
  description,
  metaLine,
  sdgIds,
  sdgShowLabel = true,
  photoUrls = [],
  onAddPhotos,
  onRemovePhoto,
  photoUploadBusy,
  photoUploadProgress,
  onRequestRemoveFromToday,
  removeFromTodayPending,
  onRequestEdit,
  editPending,
  readOnly = false,
}: Props) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const stampZoneRef = useRef<HTMLSpanElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  /** 已選檔、父層尚未進入 pending 前的瞬間，避免「完全沒回饋」 */
  const [localPicking, setLocalPicking] = useState(false);
  const fileInputId = useId();
  const [stamping, setStamping] = useState(false);
  const [userStamped, setUserStamped] = useState(false);
  const [strikeReady, setStrikeReady] = useState(false);

  const visualDone = done && !stamping;

  useEffect(() => {
    if (!stamping) return;
    const t = window.setTimeout(() => setStamping(false), 300);
    return () => window.clearTimeout(t);
  }, [stamping]);

  useEffect(() => {
    if (!visualDone) {
      setStrikeReady(false);
      return;
    }
    const id = requestAnimationFrame(() => setStrikeReady(true));
    return () => cancelAnimationFrame(id);
  }, [visualDone]);

  const handleClick = () => {
    if (readOnly || disabled || stamping) return;
    if (done) {
      triggerSpring(cardRef.current);
      onToggle();
      return;
    }
    setUserStamped(true);
    setStamping(true);
    triggerSpring(cardRef.current);
    spawnParticles(stampZoneRef.current);
    onToggle();
  };

  const showPhotoRow = Boolean(
    done && (onAddPhotos || photoUrls.length > 0),
  );
  const canAddMore =
    Boolean(onAddPhotos) && photoUrls.length < MAX_CHECKIN_PHOTOS;

  const showUploadProgress =
    photoUploadBusy ||
    localPicking ||
    (photoUploadProgress != null && photoUploadProgress.percent > 0);
  const progressPct =
    photoUploadProgress?.percent ??
    (photoUploadBusy ? 6 : localPicking ? 14 : 0);
  const progressMsg =
    photoUploadProgress?.message ??
    (photoUploadBusy ? "處理中…" : localPicking ? "準備上傳…" : "");

  return (
    <div className="overflow-visible rounded-[14px] border-[0.5px] border-[var(--color-muted)] bg-[var(--color-white)]">
    <div className="flex items-start gap-1">
    <button
      ref={cardRef}
      type="button"
      disabled={readOnly ? false : disabled || stamping}
      onClick={handleClick}
      className={[
        "gg-checklist-row group relative flex min-h-[44px] min-w-0 flex-1 flex-col gap-2 overflow-visible rounded-[14px] px-4 py-[0.85rem] text-left transition-[background-color,border-color] duration-200",
        visualDone ? "done" : "",
        stamping ? "stamping" : "",
        strikeReady && visualDone ? "strike-ready" : "",
        userStamped ? "user-stamped" : "",
        readOnly ? "cursor-default" : "",
        !readOnly && disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span ref={stampZoneRef} className="gg-stamp-wrap">
          <span className="gg-stamp-circle" aria-hidden />
          <span className="gg-stamp-leaf">
            <Leaf
              className="text-[var(--color-primary-dark)]"
              strokeWidth={2.2}
              size={36}
              aria-hidden
            />
          </span>
          {stamping ? (
            <span className="gg-stamp-ripple-ring" aria-hidden />
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="gg-checklist-title-wrap">
            <p
              className={[
                "gg-checklist-title relative z-10 text-sm font-medium leading-snug transition-colors duration-200",
                visualDone ? "" : "text-[var(--color-ink)]",
              ].join(" ")}
            >
              {title}
            </p>
          </div>
          {metaLine ? (
            <div className="mt-0.5 text-xs text-[var(--color-ink-secondary)]">
              {metaLine}
            </div>
          ) : null}
          {description ? (
            <p
              className={[
                "gg-checklist-desc mt-1 text-sm leading-relaxed",
                visualDone ? "" : "text-[var(--color-ink-secondary)]",
              ].join(" ")}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {sdgIds?.length ? (
        <div className="mt-[5px] flex flex-wrap gap-1 pl-14">
          {sdgIds.map((id) => (
            <SdgTag key={id} id={id} showLabel={sdgShowLabel} />
          ))}
        </div>
      ) : null}
    </button>
    {(onRequestEdit || onRequestRemoveFromToday) ? (
      <div className="mt-2 mr-1 flex shrink-0 flex-col gap-0.5">
        {onRequestEdit ? (
          <button
            type="button"
            disabled={disabled || Boolean(editPending)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestEdit();
            }}
            className="rounded-full p-2.5 text-[var(--color-ink-secondary)] transition-colors hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
            aria-label="編輯此自訂項目"
          >
            <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        ) : null}
        {onRequestRemoveFromToday ? (
          <button
            type="button"
            disabled={disabled || Boolean(removeFromTodayPending)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestRemoveFromToday();
            }}
            className="rounded-full p-2.5 text-[var(--color-ink-secondary)] transition-colors hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
            aria-label="從今日清單移除此自訂項目"
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    ) : null}
    </div>

    {showPhotoRow ? (
      <div className="border-t-[0.5px] border-[var(--color-muted)] px-4 py-2.5">
        <div className="flex flex-wrap items-start gap-2">
          {photoUrls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setLightboxSrc(url)}
                className="relative block overflow-hidden rounded-lg border-[0.5px] border-[var(--color-muted)] ring-[var(--color-primary-mid)] focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`檢視第 ${idx + 1} 張`}
              >
                <img src={url} alt="" className="h-14 w-14 object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-[rgba(45,52,40,0.35)] opacity-0 transition-opacity hover:opacity-100">
                  <ZoomIn
                    className="h-6 w-6 text-white drop-shadow"
                    aria-hidden
                  />
                </span>
              </button>
              {onRemovePhoto && !readOnly ? (
                <button
                  type="button"
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-muted)] bg-[var(--color-white)] text-[var(--color-ink-secondary)] shadow hover:bg-red-50 hover:text-red-800"
                  aria-label="移除此張"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemovePhoto(idx);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {lightboxSrc ? (
          <ImageLightbox
            src={lightboxSrc}
            open
            onClose={() => setLightboxSrc(null)}
          />
        ) : null}
        {showUploadProgress ? (
          <div
            className="mt-2 space-y-1.5"
            role="status"
            aria-live="polite"
            aria-busy={photoUploadBusy}
          >
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]/40">
              <div
                className="h-full rounded-full bg-[#849B6D] shadow-sm transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(2, progressPct))}%`,
                }}
              />
            </div>
            <p className="text-[11px] font-medium leading-snug text-[var(--color-ink-secondary)]">
              {progressMsg}
            </p>
          </div>
        ) : null}
        {canAddMore ? (
          <div className="mt-2 w-full sm:w-auto">
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              multiple
              disabled={readOnly || photoUploadBusy || localPicking}
              className="sr-only"
              aria-label="選擇佐證照片"
              onChange={(e) => {
                const input = e.target;
                const raw = input.files;
                if (!raw?.length) {
                  input.value = "";
                  return;
                }
                /**
                 * 不可先清空 value 再讀取 list：`FileList` 與 input 連動，
                 * 清空後長度變 0，會靜默 return（Windows／Chrome 常見）。
                 */
                if (!onAddPhotos) {
                  console.warn(
                    "[GoGreen] 佐證照：未設定上傳回呼（onAddPhotos）。請確認項目已完成打卡且非唯讀。",
                  );
                  input.value = "";
                  return;
                }
                const room = MAX_CHECKIN_PHOTOS - photoUrls.length;
                if (room <= 0) {
                  console.warn(
                    "[GoGreen] 佐證照：已達張數上限，略過此次選檔。",
                  );
                  input.value = "";
                  return;
                }
                const files = Array.from(raw).slice(0, room);
                input.value = "";
                setLocalPicking(true);
                void (async () => {
                  try {
                    await Promise.resolve(onAddPhotos(files));
                  } catch (err) {
                    console.error("[GoGreen] 佐證照上傳流程錯誤:", err);
                  } finally {
                    setLocalPicking(false);
                  }
                })();
              }}
            />
            <label
              htmlFor={fileInputId}
              className={[
                "flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-full border-[0.5px] border-[var(--color-muted)] bg-[var(--color-bg)] px-4 py-2 text-center text-xs font-medium text-[var(--color-ink)] sm:inline-flex sm:w-auto",
                readOnly || photoUploadBusy || localPicking
                  ? "pointer-events-none cursor-default opacity-55"
                  : "",
              ].join(" ")}
            >
              {photoUploadBusy || localPicking
                ? "上傳中…"
                : photoUrls.length > 0
                  ? `新增照片（${photoUrls.length}/${MAX_CHECKIN_PHOTOS}）`
                  : "上傳佐證照片"}
            </label>
          </div>
        ) : null}
        {photoUrls.length > 0 && !canAddMore && !readOnly ? (
          <p className="mt-1 text-[10px] text-[var(--color-ink-secondary)]">
            已達 {MAX_CHECKIN_PHOTOS} 張上限
          </p>
        ) : null}
      </div>
    ) : null}
    </div>
  );
}
