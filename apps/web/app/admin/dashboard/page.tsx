import { AppShell } from "@/components/app/AppShell";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const profile = await requireProfile("/admin/dashboard");
  const data = await getCipDashboardData(profile);
  const admin = createAdminSupabaseClient();
  const auditResult = admin
    ? await admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(8)
    : { data: [] };
  const audit = (auditResult.data ?? []) as Array<{ id: string; action: string; target_id: string | null; created_at: string; details: Record<string, unknown> }>;
  const operators = data.users.filter((user) => user.role === "operator");
  const engineers = data.users.filter((user) => user.role === "engineer");
  const admins = data.users.filter((user) => user.role === "admin");
  const active = data.users.filter((user) => user.status === "Actif");
  const disabled = data.users.filter((user) => user.status === "Inactif");
  const recentUsers = [...data.users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const latestLogins = [...data.users]
    .filter((user) => user.lastSignInAt)
    .sort((a, b) => (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? ""))
    .slice(0, 6);

  return (
    <AppShell
      profile={profile}
      activePath="/admin/dashboard"
      title="Administration Digital CIP"
      subtitle="Pilotage qualite, utilisateurs et supervision globale"
      alertCount={data.metrics.activeAlerts}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Utilisateurs", data.users.length],
            ["Operateurs", operators.length],
            ["Ingenieurs", engineers.length],
            ["Admins", admins.length],
            ["Desactives", disabled.length]
          ].map(([label, value]) => (
            <section key={label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#315941] dark:bg-[#0c1811]">
              <p className="text-sm font-bold text-slate-500">{label}</p>
              <p className="mt-3 text-4xl font-black text-slate-950 dark:text-white">{value}</p>
            </section>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#315941] dark:bg-[#0c1811]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Derniers comptes</h2>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-formital-green">{active.length} actifs</span>
            </div>
            <div className="mt-4 grid max-h-[30rem] gap-3 overflow-y-auto pr-1">
              {recentUsers.map((user) => (
                <article key={user.id} className="rounded-lg border border-slate-200 p-4 dark:border-[#315941]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950 dark:text-white">{user.name}</p>
                      <p className="truncate text-sm font-semibold text-slate-500">{user.email}</p>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wide text-formital-green">{user.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#315941] dark:bg-[#0c1811]">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Dernieres connexions</h2>
            <div className="mt-4 grid max-h-[30rem] gap-3 overflow-y-auto pr-1">
              {latestLogins.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Aucune connexion recente disponible.</p>
              ) : (
                latestLogins.map((user) => (
                  <article key={user.id} className="rounded-lg border border-slate-200 p-4 dark:border-[#315941]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950 dark:text-white">{user.name}</p>
                        <p className="truncate text-sm font-semibold text-slate-500">{user.email}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-500">{new Date(user.lastSignInAt ?? "").toLocaleString("fr-FR")}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#315941] dark:bg-[#0c1811] xl:col-span-2">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Historique admin</h2>
            <div className="mt-4 grid max-h-[30rem] gap-3 overflow-y-auto pr-1">
              {audit.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Aucune action audit enregistree.</p>
              ) : (
                audit.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-[#315941]">
                    <div className="flex flex-wrap justify-between gap-2">
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
      </div>
    </AppShell>
  );
}
