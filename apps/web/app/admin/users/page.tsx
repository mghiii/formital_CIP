import { AppShell } from "@/components/app/AppShell";
import { AdminUsersWorkspace } from "@/components/app/AdminUsersWorkspace";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function AdminUsersPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const profile = await requireProfile("/admin/users");
  const data = await getCipDashboardData(profile);
  const notice =
    typeof searchParams?.admin_error === "string"
      ? searchParams.admin_error
      : searchParams?.admin_created === "1"
        ? "Compte cree avec succes."
        : searchParams?.admin_updated === "1"
          ? "Compte mis a jour."
          : searchParams?.admin_archived === "1"
            ? "Compte archive et desactive. Les cycles CIP restent conserves."
            : searchParams?.admin_deleted === "1"
              ? "Compte supprime."
              : undefined;

  return (
    <AppShell profile={profile} activePath="/admin/users" title="Utilisateurs" subtitle="Comptes, roles et statut actif" alertCount={data.metrics.activeAlerts}>
      <AdminUsersWorkspace users={data.users} profile={profile} notice={notice} />
    </AppShell>
  );
}
