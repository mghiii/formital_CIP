import { AppShell } from "@/components/app/AppShell";
import { AlertsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function EngineerAlertsPage() {
  const profile = await requireProfile("/engineer/alerts");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/engineer/alerts" title="Alertes qualite" subtitle="Traitement des anomalies et non conformites" alertCount={data.metrics.activeAlerts}>
      <AlertsWorkspace data={data} />
    </AppShell>
  );
}
