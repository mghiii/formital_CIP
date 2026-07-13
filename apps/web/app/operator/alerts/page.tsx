import { AppShell } from "@/components/app/AppShell";
import { AlertsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type OperatorAlertsPageProps = {
  searchParams?: {
    updated?: string;
    error?: string;
  };
};

export default async function OperatorAlertsPage({ searchParams }: OperatorAlertsPageProps) {
  const profile = await requireProfile("/operator/alerts");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/operator/alerts" title="Alertes" subtitle="Alertes terrain et actions correctives rapides" alertCount={data.metrics.activeAlerts}>
      <AlertsWorkspace data={data} profile={profile} alertUpdated={searchParams?.updated === "alert"} alertError={searchParams?.error} />
    </AppShell>
  );
}
