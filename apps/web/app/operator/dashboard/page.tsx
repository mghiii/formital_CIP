import { AppShell } from "@/components/app/AppShell";
import { OperatorDashboardView } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

type OperatorDashboardPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function OperatorDashboardPage({ searchParams }: OperatorDashboardPageProps) {
  const profile = await requireProfile("/operator/dashboard");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell
      profile={profile}
      activePath="/operator/dashboard"
      title="Bienvenue, Operateur CIP"
      subtitle="Execution guidee des cycles, checklist et alertes terrain"
      alertCount={data.metrics.activeAlerts}
    >
      <OperatorDashboardView profile={profile} data={data} workflowError={searchParams?.error} />
    </AppShell>
  );
}
