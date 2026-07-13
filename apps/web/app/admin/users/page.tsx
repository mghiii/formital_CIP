import { AppShell } from "@/components/app/AppShell";
import { UsersWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function AdminUsersPage() {
  const profile = await requireProfile("/admin/users");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/admin/users" title="Utilisateurs" subtitle="Comptes, roles et statut actif" alertCount={data.metrics.activeAlerts}>
      <UsersWorkspace data={data} />
    </AppShell>
  );
}
