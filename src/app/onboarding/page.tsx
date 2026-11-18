import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-session";
import { listUserMemberships } from "@/repositories/auth.repository";
import { OnboardingForm } from "./_components/onboarding-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Setup LSP Pertama — AsesorKompetensi",
};

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const memberships = await listUserMemberships(user.id);
  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  const metadataFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  return (
    <OnboardingForm
      userEmail={user.email ?? ""}
      defaultFullName={metadataFullName}
    />
  );
}
