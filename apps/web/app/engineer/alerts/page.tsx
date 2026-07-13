import { AppShell } from "@/components/app/AppShell";
import { AlertsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type EngineerAlertsPageProps = {
  searchParams?: {
    updated?: string;
    error?: string;
  };
};

export default async function EngineerAlertsPage({ searchParams }: EngineerAlertsPageProps) {
  const profile = await requireProfile("/engineer/alerts");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/engineer/alerts" title="Alertes qualite" subtitle="Traitement des anomalies et non conformites" alertCount={data.metrics.activeAlerts}>
      <AlertsWorkspace data={data} profile={profile} alertUpdated={searchParams?.updated === "alert"} alertError={searchParams?.error} />
    </AppShell>
  );
}
