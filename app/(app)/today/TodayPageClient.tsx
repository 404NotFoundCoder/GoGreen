"use client";

import { TodayChecklist } from "@/components/checklist/TodayChecklist";
import { getTodayString } from "@/lib/utils/date";
import { useSearchParams } from "next/navigation";

export function TodayPageClient() {
  const sp = useSearchParams();
  const raw = sp.get("date");
  const date =
    raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayString();
  return <TodayChecklist selectedDate={date} />;
}
