"use client";

import { ChecklistStampCard } from "@/components/checklist/ChecklistStampCard";
import type { ChecklistItemRow } from "@/lib/supabase/checklist";

type Props = {
  item: ChecklistItemRow;
  done: boolean;
  onToggle: () => void;
  disabled?: boolean;
  sdgShowLabel?: boolean;
  photoUrl?: string | null;
  onUploadPhoto?: (file: File) => void;
  photoUploadBusy?: boolean;
};

export function ChecklistRow({
  item,
  done,
  onToggle,
  disabled,
  sdgShowLabel,
  photoUrl,
  onUploadPhoto,
  photoUploadBusy,
}: Props) {
  return (
    <ChecklistStampCard
      done={done}
      disabled={disabled}
      onToggle={onToggle}
      title={item.title}
      description={item.description}
      sdgIds={item.sdg_ids ?? undefined}
      sdgShowLabel={sdgShowLabel}
      photoUrl={photoUrl}
      onUploadPhoto={onUploadPhoto}
      photoUploadBusy={photoUploadBusy}
    />
  );
}
