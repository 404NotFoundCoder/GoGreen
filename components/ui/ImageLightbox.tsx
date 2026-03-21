"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type Props = {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
};

export function ImageLightbox({ src, alt = "佐證照片", open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-[rgba(45,52,40,0.92)] p-3"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div className="flex shrink-0 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] rounded-full p-2 text-white/90 hover:bg-white/10"
          aria-label="關閉"
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>
      <button
        type="button"
        className="flex min-h-0 flex-1 cursor-zoom-out items-center justify-center p-2"
        onClick={onClose}
        aria-label="點擊關閉"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 動態使用者 URL */}
        <img
          src={src}
          alt={alt}
          className="max-h-[min(85vh,100%)] max-w-full object-contain"
        />
      </button>
    </div>
  );
}
