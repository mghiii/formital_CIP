import { AppShell } from "@/components/app/AppShell";
import { SettingsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type AdminSettingsPageProps = {
  searchParams?: {
    operator_created?: string;
    operator_error?: string;
  };
};

export default async function AdminSettingsPage({ searchParams }: AdminSettingsPageProps) {
  const profile = await requireProfile("/admin/settings");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/admin/settings" title="Parametres systeme" subtitle="Securite, seuils et configuration de la plateforme" alertCount={data.metrics.activeAlerts}>
      <SettingsWorkspace data={data} operatorCreated={searchParams?.operator_created === "1"} operatorError={searchParams?.operator_error} />
    </AppShell>
  );
}
