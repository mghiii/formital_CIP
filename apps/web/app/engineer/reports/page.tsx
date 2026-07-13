import { AppShell } from "@/components/app/AppShell";
import { ReportsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function EngineerReportsPage() {
  const profile = await requireProfile("/engineer/reports");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/engineer/reports" title="Rapports et KPI" subtitle="Exports, indicateurs et dossiers qualite" alertCount={data.metrics.activeAlerts}>
      <ReportsWorkspace data={data} />
    </AppShell>
  );
}
