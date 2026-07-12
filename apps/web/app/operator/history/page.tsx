import { AppShell } from "@/components/app/AppShell";
import { HistoryWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function OperatorHistoryPage() {
  const profile = await requireProfile("/operator/history");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/operator/history" title="Historique CIP" subtitle="Consultation des cycles realises" alertCount={data.metrics.activeAlerts}>
      <HistoryWorkspace data={data} />
    </AppShell>
  );
}
