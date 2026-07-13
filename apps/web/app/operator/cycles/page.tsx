import { AppShell } from "@/components/app/AppShell";
import { CyclesWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type OperatorCyclesPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function OperatorCyclesPage({ searchParams }: OperatorCyclesPageProps) {
  const profile = await requireProfile("/operator/cycles");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/operator/cycles" title="Cycles CIP" subtitle="Demarrage, suivi et validation des cycles de nettoyage" alertCount={data.metrics.activeAlerts}>
      <CyclesWorkspace profile={profile} data={data} workflowError={searchParams?.error} />
    </AppShell>
  );
}
