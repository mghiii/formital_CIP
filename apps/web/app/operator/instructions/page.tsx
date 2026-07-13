import { AppShell } from "@/components/app/AppShell";
import { InstructionsWorkspace } from "@/components/app/CipViews";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";

export default async function OperatorInstructionsPage() {
  const profile = await requireProfile("/operator/instructions");
  const data = await getCipDashboardData(profile);

  return (
    <AppShell profile={profile} activePath="/operator/instructions" title="Instructions CIP" subtitle="Consignes par atelier et equipement" alertCount={data.metrics.activeAlerts}>
      <InstructionsWorkspace data={data} />
    </AppShell>
  );
}
