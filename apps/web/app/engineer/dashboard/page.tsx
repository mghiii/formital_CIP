import { AppShell } from "@/components/app/AppShell";
import { QualityDashboardView } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function EngineerDashboardPage() {
  const profile = await requireProfile("/engineer/dashboard");
  const data = await getCipDashboardData();

  return (
    <AppShell
      profile={profile}
      activePath="/engineer/dashboard"
      title="Bienvenue, Responsable Qualite"
      subtitle="Suivi et analyse des operations CIP"
      alertCount={data.metrics.activeAlerts}
    >
      <QualityDashboardView data={data} />
    </AppShell>
  );
}
