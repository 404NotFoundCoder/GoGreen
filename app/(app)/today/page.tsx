import { Suspense } from "react";
import { TodayPageClient } from "./TodayPageClient";

export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <TodayPageClient />
    </Suspense>
  );
}
