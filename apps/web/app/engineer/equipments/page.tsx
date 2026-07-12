import { AppShell } from "@/components/app/AppShell";
import { EquipmentsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function EngineerEquipmentsPage() {
  const profile = await requireProfile("/engineer/equipments");
  const data = await getCipDashboardData();

  return (
    <AppShell profile={profile} activePath="/engineer/equipments" title="Equipements" subtitle="Supervision des equipements et limites de reference" alertCount={data.metrics.activeAlerts}>
      <EquipmentsWorkspace data={data} />
    </AppShell>
  );
}
