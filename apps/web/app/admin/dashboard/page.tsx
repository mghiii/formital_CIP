import { AppShell } from "@/components/app/AppShell";
import { QualityDashboardView } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function AdminDashboardPage() {
  const profile = await requireProfile("/admin/dashboard");
  const data = await getCipDashboardData();

  return (
    <AppShell
      profile={profile}
      activePath="/admin/dashboard"
      title="Administration Digital CIP"
      subtitle="Pilotage qualite, utilisateurs et supervision globale"
      alertCount={data.metrics.activeAlerts}
    >
      <QualityDashboardView data={data} />
    </AppShell>
  );
}
