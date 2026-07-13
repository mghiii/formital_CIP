import { AppShell } from "@/components/app/AppShell";
import { requireProfile } from "@/lib/auth/session";
import { getCipDashboardData } from "@/lib/cip/data";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const profile = await requireProfile("/admin/audit");
  const data = await getCipDashboardData(profile);
  const admin = createAdminSupabaseClient();
  const action = typeof searchParams?.action === "string" ? searchParams.action.trim() : "";
  const query = admin
    ? admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100)
    : null;
  const result = query && action ? await query.ilike("action", `%${action}%`) : query ? await query : { data: [] };
  const audit = (result.data ?? []) as Array<{ id: string; action: string; target_id: string | null; actor_id: string | null; created_at: string; details: Record<string, unknown> }>;

  return (
    <AppShell profile={profile} activePath="/admin/audit" title="Audit administration" subtitle="Actions sensibles, roles et comptes" alertCount={data.metrics.activeAlerts}>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-[#315941] dark:bg-[#0c1811]">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input name="action" defaultValue={action} placeholder="Filtrer par action: user.created, user.updated..." className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#07170f]" />
          <button className="min-h-11 rounded-lg bg-formital-green px-4 font-bold text-white">Filtrer</button>
        </form>
        <div className="mt-5 grid max-h-[42rem] gap-3 overflow-y-auto pr-1">
          {audit.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">Aucune action audit trouvee.</p>
          ) : (
            audit.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-[#315941]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-black text-slate-950 dark:text-white">{item.action}</p>
                  <p className="text-sm font-semibold text-slate-500">{new Date(item.created_at).toLocaleString("fr-FR")}</p>
                </div>
                <div className="mt-2 grid gap-1 text-sm font-semibold text-slate-500">
                  <p>Cible: {item.target_id ?? "-"}</p>
                  <p>Auteur: {item.actor_id ?? "-"}</p>
                  <p className="break-words">Details: {JSON.stringify(item.details)}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
