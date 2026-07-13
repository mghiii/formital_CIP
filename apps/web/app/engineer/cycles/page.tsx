import { AppShell } from "@/components/app/AppShell";
import { CyclesWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type EngineerCyclesPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function EngineerCyclesPage({ searchParams }: EngineerCyclesPageProps) {
  const profile = await requireProfile("/engineer/cycles");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/engineer/cycles" title="Cycles CIP" subtitle="Planification, controle et analyse des cycles" alertCount={data.metrics.activeAlerts}>
      <CyclesWorkspace profile={profile} data={data} workflowError={searchParams?.error} />
    </AppShell>
  );
}
