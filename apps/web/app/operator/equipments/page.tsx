import { AppShell } from "@/components/app/AppShell";
import { EquipmentsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function OperatorEquipmentsPage() {
  const profile = await requireProfile("/operator/equipments");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/operator/equipments" title="Equipements" subtitle="Etat des lignes, citernes et circuits CIP" alertCount={data.metrics.activeAlerts}>
      <EquipmentsWorkspace data={data} />
    </AppShell>
  );
}
