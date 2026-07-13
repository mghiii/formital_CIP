"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { useState } from "react";
import { FormitalLogo } from "@/components/brand/FormitalLogo";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import type { AppRole, Profile } from "@/types/auth";

type NavItem = {
  label: string;
  mobileLabel?: string;
  href: string;
  icon: IconName;
  badge?: "alerts";
};

type IconName = "home" | "cycle" | "history" | "equipment" | "kpi" | "alert" | "settings" | "report" | "users" | "instruction";

const navByRole: Record<AppRole, NavItem[]> = {
  operator: [
    { label: "Tableau de bord", mobileLabel: "Dashboard", href: "/operator/dashboard", icon: "home" },
    { label: "Cycles CIP", href: "/operator/cycles", icon: "cycle" },
    { label: "Historique", href: "/operator/history", icon: "history" },
    { label: "Equipements", mobileLabel: "Machines", href: "/operator/equipments", icon: "equipment" },
    { label: "Alertes", href: "/operator/alerts", icon: "alert", badge: "alerts" },
    { label: "Instructions CIP", href: "/operator/instructions", icon: "instruction" }
  ],
  engineer: [
    { label: "Tableau de bord", mobileLabel: "Dashboard", href: "/engineer/dashboard", icon: "home" },
    { label: "Cycles CIP", href: "/engineer/cycles", icon: "cycle" },
    { label: "Historique", href: "/engineer/history", icon: "history" },
    { label: "Equipements", mobileLabel: "Machines", href: "/engineer/equipments", icon: "equipment" },
    { label: "Indicateurs KPI", mobileLabel: "KPI", href: "/engineer/reports", icon: "kpi" },
    { label: "Alertes", href: "/engineer/alerts", icon: "alert", badge: "alerts" },
    { label: "Administration", mobileLabel: "Admin", href: "/admin/users", icon: "users" },
    { label: "Parametres", href: "/engineer/settings", icon: "settings" }
  ],
  admin: [
    { label: "Tableau de bord", mobileLabel: "Dashboard", href: "/admin/dashboard", icon: "home" },
    { label: "Equipements", mobileLabel: "Machines", href: "/admin/equipments", icon: "equipment" },
    { label: "Alertes", href: "/admin/alerts", icon: "alert", badge: "alerts" },
    { label: "Rapports", href: "/admin/reports", icon: "report" },
    { label: "Utilisateurs", href: "/admin/users", icon: "users" },
    { label: "Audit", href: "/admin/audit", icon: "report" },
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ProfileBadge({ profile, compact = false }: { profile: Profile; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-[#315941] dark:bg-[#102218] ${compact ? "min-w-0 px-2 py-2" : "px-3 py-2"}`}>
      <div className={`${compact ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm"} grid shrink-0 place-items-center rounded-full bg-formital-green/10 font-bold text-formital-green dark:bg-[#193f29] dark:text-[#64d889]`}>
        {(profile.full_name ?? profile.email ?? "U").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className={`${compact ? "max-w-[8.25rem] text-xs" : "text-sm"} truncate font-semibold`}>{profile.full_name ?? profile.email}</p>
        <p className={`${compact ? "text-[11px]" : "text-xs"} truncate text-muted`}>{roleLabel(profile.role)}</p>
      </div>
    </div>
  );
}

function SidebarContent({
  navItems,
  activePath,
  alertCount,
  onNavigate,
  showClose,
  onClose
}: {
  navItems: NavItem[];
  activePath: string;
  alertCount: number;
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex h-28 items-center justify-between border-b border-white/15 px-7">
        <FormitalLogo framed className="justify-center" />
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white hover:text-formital-green"
            aria-label="Fermer le menu"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>
      <nav className="flex-1 space-y-3 px-4 py-7">
        {navItems.map((item) => {
          const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
          const count = item.badge === "alerts" ? alertCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              onClick={onNavigate}
              className={`flex h-14 items-center justify-between rounded-xl px-5 text-base font-bold transition ${
                active ? "bg-white text-formital-green shadow-lg dark:bg-white/95 dark:text-formital-green" : "text-white/90 hover:bg-white/10"
              }`}
            >
              <span className="flex items-center gap-5">
                <span className="grid h-7 w-7 place-items-center" aria-hidden="true">
                  <NavIcon name={item.icon} />
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
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
    </>
  );
}

export function AppShell({ profile, activePath, title, subtitle, children, actions, alertCount = 0 }: AppShellProps) {
  const navItems = navByRole[profile.role];
  const bottomNavItems = navItems.slice(0, 5);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[#f5f7f4] text-ink transition-colors dark:bg-[#07120d]">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-formital-green text-white shadow-2xl transition-colors dark:bg-[#0d2f1b] lg:flex">
        <SidebarContent navItems={navItems} activePath={activePath} alertCount={alertCount} />
      </aside>
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-[min(22rem,88vw)] flex-col overflow-y-auto bg-formital-green text-white shadow-2xl dark:bg-[#0b2a18]">
            <SidebarContent
              navItems={navItems}
              activePath={activePath}
              alertCount={alertCount}
              onNavigate={() => setSidebarOpen(false)}
              showClose
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur transition-colors dark:border-[#214531] dark:bg-[#0c1811]/95 sm:px-5 lg:px-8 lg:pt-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-formital-green shadow-sm transition hover:border-formital-green hover:bg-formital-green/10 dark:border-[#315941] dark:bg-[#102218] dark:text-[#64d889]"
                aria-label="Ouvrir le menu"
                aria-expanded={sidebarOpen}
              >
                <MenuIcon />
              </button>
              <div className="flex min-w-0 justify-center">
                <FormitalLogo compact showText={false} />
              </div>
              <div className="min-w-0">
                <ProfileBadge profile={profile} compact />
              </div>
            </div>
            <div className="hidden min-w-0 lg:block">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-formital-green">{title}</h1>
                <p className="mt-1 text-sm text-muted">{subtitle}</p>
              </div>
            </div>
            <div className="hidden flex-wrap items-center gap-3 lg:flex">
              {actions}
              <ProfileBadge profile={profile} />
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3 lg:hidden">{actions}</div> : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[112rem] min-w-0 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 lg:px-8 lg:pb-8 lg:pt-6">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgba(15,23,42,0.10)] backdrop-blur dark:border-[#214531] dark:bg-[#0c1811]/95 lg:hidden" aria-label="Navigation principale mobile">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          {bottomNavItems.map((item) => {
            const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
            const count = item.badge === "alerts" ? alertCount : 0;

            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition ${
                  active
                    ? "bg-formital-green text-white shadow-sm"
                    : "text-slate-600 hover:bg-formital-green/10 hover:text-formital-green dark:text-slate-300"
                }`}
              >
                <NavIcon name={item.icon} />
                <span className="max-w-full whitespace-nowrap">{item.mobileLabel ?? item.label}</span>
                {count > 0 ? <span className="absolute right-1.5 top-1.5 rounded-full bg-formital-red px-1.5 text-[10px] leading-4 text-white">{count}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
