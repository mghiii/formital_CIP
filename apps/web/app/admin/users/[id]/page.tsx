import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { canManageProfileRole } from "@/lib/auth/api";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole, Profile } from "@/types/auth";

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

function value(label: string, content: string | null | undefined) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-[#315941] dark:bg-[#07170f]">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-slate-950 dark:text-white">{content || "-"}</p>
    </div>
  );
}

function badge(value: string) {
  const tone = value === "Actif" || value === "Conforme" || value === "Termine" ? "bg-green-50 text-formital-green" : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}

export default async function AdminUserDetailPage({ params, searchParams }: PageProps) {
  const profile = await requireProfile(`/admin/users/${params.id}`);
  const admin = createAdminSupabaseClient();
  if (!admin) redirect("/admin/users?admin_error=Configuration serveur incomplete.");

  const [{ data: target }, data] = await Promise.all([
    admin.from("profiles").select("*").eq("id", params.id).single(),
    getCipDashboardData(profile)
  ]);

  if (!target) notFound();

  const targetProfile = target as Profile & { badge_rfid?: string | null };
  if (!canManageProfileRole(profile, targetProfile.role as AppRole, "read")) {
    redirect("/admin/users?admin_error=Lecture non autorisee pour ce compte.");
  }

  const cycles = data.cycles.filter((cycle) => cycle.operatorId === params.id);
  const activeCycles = cycles.filter((cycle) => cycle.status === "En cours" || cycle.status === "Planifie");
  const completedCycles = cycles.filter((cycle) => cycle.status === "Termine");
  const relatedEquipments = new Set(cycles.map((cycle) => cycle.equipment));
  const alerts = data.alerts.filter((alert) => relatedEquipments.has(alert.equipment));
  const auditRows = await admin
    .from("admin_audit_log")
    .select("*")
    .eq("target_id", params.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const audit = (auditRows.data ?? []) as Array<{ id: string; action: string; created_at: string; actor_id: string | null; details: Record<string, unknown> }>;
  const notice =
    typeof searchParams?.admin_error === "string"
      ? searchParams.admin_error
      : searchParams?.admin_updated === "1"
        ? "Compte mis a jour."
        : undefined;

  return (
    <AppShell profile={profile} activePath="/admin/users" title={targetProfile.full_name ?? "Utilisateur"} subtitle="Fiche compte, cycles, alertes et audit" alertCount={data.metrics.activeAlerts}>
      <div className="grid gap-6">
        {notice ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{notice}</div> : null}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#315941] dark:bg-[#0c1811]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-formital-green">Compte</p>
              <h2 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{targetProfile.full_name ?? targetProfile.email}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {badge(targetProfile.role)}
                {badge(targetProfile.is_active === false || targetProfile.status === "inactive" ? "Inactif" : "Actif")}
              </div>
            </div>
            <form action={`/api/admin/users/${params.id}`} method="post" className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="action" value="reset_password" />
              <input name="password" type="password" minLength={8} required placeholder="Nouveau mot de passe" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#07170f]" />
              <button className="min-h-11 rounded-lg bg-formital-green px-4 font-bold text-white">Reset mot de passe</button>
            </form>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {value("Email", targetProfile.email)}
            {value("Telephone", targetProfile.phone)}
            {value("Matricule", targetProfile.matricule)}
            {value("Atelier", targetProfile.workshop)}
            {value("Departement", targetProfile.department)}
            {value("Cree le", targetProfile.created_at ? new Date(targetProfile.created_at).toLocaleString("fr-FR") : "-")}
            {value("Derniere connexion", targetProfile.last_sign_in_at ? new Date(targetProfile.last_sign_in_at).toLocaleString("fr-FR") : "-")}
            {value("Badge RFID", targetProfile.rfid_badge_id ?? targetProfile.badge_rfid)}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          {value("Cycles total", String(cycles.length))}
          {value("En cours / planifies", String(activeCycles.length))}
          {value("Termines", String(completedCycles.length))}
          {value("Alertes liees", String(alerts.length))}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#315941] dark:bg-[#0c1811]">
          <h3 className="text-xl font-black text-slate-950 dark:text-white">Historique audit</h3>
          <div className="mt-4 grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
            {audit.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Aucune action audit visible.</p>
            ) : (
              audit.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-[#315941]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-slate-950 dark:text-white">{item.action}</p>
                    <p className="text-sm font-semibold text-slate-500">{new Date(item.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-500">{JSON.stringify(item.details)}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
