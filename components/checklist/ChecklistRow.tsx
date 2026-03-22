"use client";

import { ChecklistStampCard } from "@/components/checklist/ChecklistStampCard";
import type { ChecklistItemRow } from "@/lib/supabase/checklist";

type Props = {
  item: ChecklistItemRow;
  done: boolean;
  onToggle: () => void;
  disabled?: boolean;
  sdgShowLabel?: boolean;
  photoUrls?: string[];
  onAddPhotos?: (files: File[]) => void | Promise<void>;
  onRemovePhoto?: (index: number) => void;
  photoUploadBusy?: boolean;
  photoUploadProgress?: { percent: number; message: string } | null;
  readOnly?: boolean;
};

export function ChecklistRow({
  item,
  done,
  onToggle,
  disabled,
  sdgShowLabel,
  photoUrls = [],
  onAddPhotos,
  onRemovePhoto,
  photoUploadBusy,
  photoUploadProgress = null,
  readOnly,
}: Props) {
  return (
    <ChecklistStampCard
      done={done}
      disabled={disabled}
      readOnly={readOnly}
      onToggle={onToggle}
      title={item.title}
      description={item.description}
      sdgIds={item.sdg_ids ?? undefined}
      sdgShowLabel={sdgShowLabel}
      photoUrls={photoUrls}
      onAddPhotos={onAddPhotos}
      onRemovePhoto={onRemovePhoto}
      photoUploadBusy={photoUploadBusy}
      photoUploadProgress={photoUploadProgress}
    />
  );
}
