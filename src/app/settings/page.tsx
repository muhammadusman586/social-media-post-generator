import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { SetupChecklist } from "@/features/profile/components/setup-checklist";
import { VoiceSamples } from "@/features/profile/components/voice-samples";
import { getProfile, listRecentFinals, listVoiceSamples } from "@/features/profile/queries";
import { requireOwner } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireOwner();
  const [profile, samples, finals] = await Promise.all([getProfile(), listVoiceSamples(), listRecentFinals()]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Link
        href="/settings/reflections"
        className="flex items-center justify-between rounded-xl border px-4 py-3 font-medium hover:bg-muted"
      >
        Reflections
        <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Profile</h2>
        <ProfileForm value={profile} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Voice samples</h2>
        <VoiceSamples samples={samples} finals={finals} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Setup checklist</h2>
        <SetupChecklist />
      </section>
    </>
  );
}
