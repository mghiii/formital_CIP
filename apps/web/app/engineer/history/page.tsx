import { AppShell } from "@/components/app/AppShell";
import { CyclesTable } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function EngineerHistoryPage() {
  const profile = await requireProfile("/engineer/history");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/engineer/history" title="Historique CIP" subtitle="Recherche et consultation des cycles termines" alertCount={data.metrics.activeAlerts}>
      <CyclesTable cycles={data.cycles} checklists={data.checklists} allowDelete />
    </AppShell>
  );
}
