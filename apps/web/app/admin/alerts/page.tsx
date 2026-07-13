import { AppShell } from "@/components/app/AppShell";
import { AlertsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type AdminAlertsPageProps = {
  searchParams?: {
    updated?: string;
    error?: string;
  };
};

export default async function AdminAlertsPage({ searchParams }: AdminAlertsPageProps) {
  const profile = await requireProfile("/admin/alerts");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/admin/alerts" title="Alertes qualite" subtitle="Traitement des anomalies et non conformites" alertCount={data.metrics.activeAlerts}>
      <AlertsWorkspace data={data} profile={profile} alertUpdated={searchParams?.updated === "alert"} alertError={searchParams?.error} />
    </AppShell>
  );
}
