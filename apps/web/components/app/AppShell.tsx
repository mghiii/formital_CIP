import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { FormitalLogo } from "@/components/brand/FormitalLogo";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import type { AppRole, Profile } from "@/types/auth";

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  badge?: "alerts";
};

type IconName = "home" | "cycle" | "history" | "equipment" | "kpi" | "alert" | "settings" | "report" | "users" | "instruction";

const navByRole: Record<AppRole, NavItem[]> = {
  operator: [
    { label: "Tableau de bord", href: "/operator/dashboard", icon: "home" },
    { label: "Cycles CIP", href: "/operator/cycles", icon: "cycle" },
    { label: "Historique", href: "/operator/history", icon: "history" },
    { label: "Equipements", href: "/operator/equipments", icon: "equipment" },
    { label: "Alertes", href: "/operator/alerts", icon: "alert", badge: "alerts" },
    { label: "Instructions CIP", href: "/operator/instructions", icon: "instruction" }
  ],
  engineer: [
    { label: "Tableau de bord", href: "/engineer/dashboard", icon: "home" },
    { label: "Cycles CIP", href: "/engineer/cycles", icon: "cycle" },
    { label: "Historique", href: "/engineer/history", icon: "history" },
    { label: "Equipements", href: "/engineer/equipments", icon: "equipment" },
    { label: "Indicateurs KPI", href: "/engineer/reports", icon: "kpi" },
    { label: "Alertes", href: "/engineer/alerts", icon: "alert", badge: "alerts" },
    { label: "Parametres", href: "/engineer/settings", icon: "settings" }
  ],
  admin: [
    { label: "Tableau de bord", href: "/admin/dashboard", icon: "home" },
    { label: "Cycles CIP", href: "/engineer/cycles", icon: "cycle" },
    { label: "Equipements", href: "/engineer/equipments", icon: "equipment" },
    { label: "Alertes", href: "/engineer/alerts", icon: "alert", badge: "alerts" },
    { label: "Rapports", href: "/engineer/reports", icon: "report" },
    { label: "Utilisateurs", href: "/admin/users", icon: "users" },
    { label: "Parametres", href: "/admin/settings", icon: "settings" }
  ]
};

type AppShellProps = {
  profile: Profile;
  activePath: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
  alertCount?: number;
};

function roleLabel(role: AppRole) {
  if (role === "admin") return "Responsable qualite";
  if (role === "engineer") return "Ingenieur process";
  return "Operateur CIP";
}

function NavIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      {name === "home" ? (
        <>
          <path {...common} d="m3 11 9-8 9 8" />
          <path {...common} d="M5 10v10h14V10" />
          <path {...common} d="M9 20v-6h6v6" />
        </>
      ) : null}
      {name === "cycle" ? (
        <>
          <path {...common} d="M17 2v5h-5" />
          <path {...common} d="M20 11a8 8 0 1 0-2.35 5.65" />
          <path {...common} d="M17 7a8.02 8.02 0 0 1 3 6" />
        </>
      ) : null}
      {name === "history" ? (
        <>
          <path {...common} d="M3 12a9 9 0 1 0 3-6.7" />
          <path {...common} d="M3 4v5h5" />
          <path {...common} d="M12 7v5l3 2" />
        </>
      ) : null}
      {name === "equipment" ? (
        <>
          <rect {...common} x="4" y="4" width="16" height="16" rx="2" />
          <path {...common} d="M8 9h8M8 13h8M8 17h4" />
        </>
      ) : null}
      {name === "kpi" ? (
        <>
          <path {...common} d="M4 19V5" />
          <path {...common} d="M4 19h16" />
          <path {...common} d="M8 16v-5" />
          <path {...common} d="M12 16V8" />
          <path {...common} d="M16 16v-3" />
        </>
      ) : null}
      {name === "alert" ? (
        <>
          <path {...common} d="M12 3 2.5 20h19L12 3Z" />
          <path {...common} d="M12 9v4" />
          <path {...common} d="M12 17h.01" />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <circle {...common} cx="12" cy="12" r="3" />
          <path {...common} d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 5 14.7a1.7 1.7 0 0 0-1.55-1H3v-3h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 8.3 5a1.7 1.7 0 0 0 1-1.55V3h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 8.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z" />
        </>
      ) : null}
      {name === "report" ? (
        <>
          <path {...common} d="M6 3h9l3 3v15H6z" />
          <path {...common} d="M14 3v4h4" />
          <path {...common} d="M9 14h6" />
          <path {...common} d="M9 18h4" />
          <path {...common} d="M9 10h2" />
        </>
      ) : null}
      {name === "users" ? (
        <>
          <circle {...common} cx="9" cy="8" r="3" />
          <path {...common} d="M3 20a6 6 0 0 1 12 0" />
          <path {...common} d="M16 11a3 3 0 0 0 0-6" />
          <path {...common} d="M18 20a5 5 0 0 0-3-4.6" />
        </>
      ) : null}
      {name === "instruction" ? (
        <>
          <path {...common} d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4Z" />
          <path {...common} d="M5 4v12" />
          <path {...common} d="M9 8h6" />
          <path {...common} d="M9 12h5" />
        </>
      ) : null}
    </svg>
  );
}

export function AppShell({ profile, activePath, title, subtitle, children, actions, alertCount = 0 }: AppShellProps) {
  const navItems = navByRole[profile.role];

  return (
    <div className="min-h-screen bg-[#f5f7f4] text-ink transition-colors dark:bg-[#07120d]">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-formital-green text-white shadow-2xl transition-colors dark:bg-[#0d2f1b] lg:flex">
        <div className="flex h-28 items-center border-b border-white/15 px-8">
          <FormitalLogo framed className="w-full justify-center" />
        </div>
        <nav className="flex-1 space-y-3 px-4 py-7">
          {navItems.map((item) => {
            const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
            const count = item.badge === "alerts" ? alertCount : 0;
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={`flex h-14 items-center justify-between rounded-xl px-5 text-base font-bold transition ${
                  active ? "bg-white text-formital-green shadow-lg dark:bg-white/95 dark:text-formital-green" : "text-white/90 hover:bg-white/10"
                }`}
              >
                <span className="flex items-center gap-5">
                  <span className="grid h-7 w-7 place-items-center" aria-hidden="true">
                    <NavIcon name={item.icon} />
                  </span>
                  {item.label}
                </span>
                {count > 0 ? <span className="shrink-0 whitespace-nowrap rounded-full bg-formital-red px-2 py-0.5 text-xs text-white">{count}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 pb-8">
          <div className="flex items-center gap-3">
            <ThemeToggle variant="sidebar" />
            <form action="/auth/logout" method="post" className="flex-1">
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-lg border border-white/25 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white hover:text-formital-green"
            >
              Deconnecter
            </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur transition-colors dark:border-[#214531] dark:bg-[#0c1811]/92 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="lg:hidden">
                <FormitalLogo compact />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-formital-green md:text-3xl">{title}</h1>
                <p className="mt-1 text-sm text-muted">{subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              <div className="lg:hidden">
                <ThemeToggle />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-colors dark:border-[#315941] dark:bg-[#102218]">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-formital-green/10 text-sm font-bold text-formital-green dark:bg-[#193f29] dark:text-[#64d889]">
                  {(profile.full_name ?? profile.email ?? "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{profile.full_name ?? profile.email}</p>
                  <p className="text-xs text-muted">{roleLabel(profile.role)}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
