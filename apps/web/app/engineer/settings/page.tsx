import { AppShell } from "@/components/app/AppShell";
import { SettingsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type EngineerSettingsPageProps = {
  searchParams?: {
    operator_created?: string;
    operator_error?: string;
  };
};

export default async function EngineerSettingsPage({ searchParams }: EngineerSettingsPageProps) {
  const profile = await requireProfile("/engineer/settings");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/engineer/settings" title="Parametres" subtitle="Seuils CIP, audit et configuration qualite" alertCount={data.metrics.activeAlerts}>
      <SettingsWorkspace data={data} operatorCreated={searchParams?.operator_created === "1"} operatorError={searchParams?.operator_error} />
    </AppShell>
  );
}
