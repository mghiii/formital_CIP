import { AppShell } from "@/components/app/AppShell";
import { SettingsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function AdminSettingsPage() {
  const profile = await requireProfile("/admin/settings");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/admin/settings" title="Parametres systeme" subtitle="Securite, seuils et configuration de la plateforme" alertCount={data.metrics.activeAlerts}>
      <SettingsWorkspace />
    </AppShell>
  );
}
