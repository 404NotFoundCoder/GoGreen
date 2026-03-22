import { ProfileAnalyticsShell } from "@/components/profile/ProfileAnalyticsShell";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default function ProfilePage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">個人資料</h1>
      </header>
      <div className="space-y-6">
        <ProfileForm />
        <ProfileAnalyticsShell />
      </div>
    </>
  );
}
