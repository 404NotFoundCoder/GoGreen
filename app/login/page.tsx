import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoginClient } from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/today");

  const sp = await searchParams;
  const raw = sp.error;
  const initialError =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? null : null;

  return <LoginClient initialError={initialError} />;
}
