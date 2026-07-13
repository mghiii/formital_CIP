import { AppShell } from "@/components/app/AppShell";
import { EquipmentsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function AdminEquipmentsPage() {
  const profile = await requireProfile("/admin/equipments");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/admin/equipments" title="Machines et ateliers" subtitle="Supervision des ateliers, machines et limites de reference" alertCount={data.metrics.activeAlerts}>
      <EquipmentsWorkspace data={data} />
    </AppShell>
  );
}
