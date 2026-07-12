import { AppShell } from "@/components/app/AppShell";
import { AlertsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function OperatorAlertsPage() {
  const profile = await requireProfile("/operator/alerts");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/operator/alerts" title="Alertes" subtitle="Alertes terrain et actions correctives rapides" alertCount={data.metrics.activeAlerts}>
      <AlertsWorkspace data={data} />
    </AppShell>
  );
}
