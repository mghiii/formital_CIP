import { AppShell } from "@/components/app/AppShell";
import { SettingsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function EngineerSettingsPage() {
  const profile = await requireProfile("/engineer/settings");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/engineer/settings" title="Parametres" subtitle="Seuils CIP, audit et configuration qualite" alertCount={data.metrics.activeAlerts}>
      <SettingsWorkspace />
    </AppShell>
  );
}
