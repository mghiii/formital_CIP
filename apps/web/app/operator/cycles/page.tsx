import { AppShell } from "@/components/app/AppShell";
import { CyclesWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function OperatorCyclesPage() {
  const profile = await requireProfile("/operator/cycles");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/operator/cycles" title="Cycles CIP" subtitle="Demarrage, suivi et validation des cycles de nettoyage" alertCount={data.metrics.activeAlerts}>
      <CyclesWorkspace profile={profile} data={data} />
    </AppShell>
  );
}
