"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CipUser } from "@/lib/cip/data";
import type { AppRole, Profile } from "@/types/auth";

type AdminUsersWorkspaceProps = {
  users: CipUser[];
  profile: Profile;
  notice?: string;
};

const pageSize = 8;

function roleLabel(role: AppRole) {
  if (role === "admin") return "Admin";
  if (role === "engineer") return "Ingenieur";
  return "Operateur";
}

function statusBadge(value: string) {
  const tone =
    value === "Actif" || value === "operator" || value === "engineer" || value === "admin"
      ? "bg-green-50 text-formital-green dark:bg-[#123820] dark:text-[#64d889]"
      : "bg-red-50 text-red-700 dark:bg-[#3d211c] dark:text-[#ffb4ad]";

  return `inline-flex shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${tone}`;
}

function infoChip(label: string, value: string) {
  return value ? (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:border-[#315941] dark:text-slate-200">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[12rem] truncate">{value}</span>
    </span>
  ) : null;
}

function canActOn(profile: Profile, user: CipUser) {
  if (profile.role === "admin") return true;
  return profile.role === "engineer" && user.role === "operator";
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#315941] dark:bg-[#07170f] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-formital-green">Administration</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-xl font-bold text-slate-500 transition hover:border-formital-green hover:text-formital-green dark:border-[#315941]"
            aria-label="Fermer la popup"
          >
            X
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}

function UserActions({
  profile,
  user,
  onEdit,
  onPassword,
  onDelete
}: {
  profile: Profile;
  user: CipUser;
  onEdit: () => void;
  onPassword: () => void;
  onDelete: () => void;
}) {
  if (!canActOn(profile, user)) {
    return <span className="text-xs font-bold text-slate-400">Lecture seule</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <form action={`/api/admin/users/${user.id}` as Route} method="post">
        <input type="hidden" name="action" value="toggle" />
        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-formital-green transition hover:border-formital-green dark:border-[#315941]">
          {user.status === "Actif" ? "Desactiver" : "Activer"}
        </button>
      </form>
      <button onClick={onEdit} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-formital-green dark:border-[#315941] dark:text-slate-100">
        Modifier
      </button>
      <button onClick={onPassword} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-formital-green dark:border-[#315941] dark:text-slate-100">
        Mot de passe
      </button>
      <button onClick={onDelete} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
        Supprimer
      </button>
    </div>
  );
}

export function AdminUsersWorkspace({ users, profile, notice }: AdminUsersWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"name" | "role" | "status" | "createdAt">("createdAt");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<CipUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<CipUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<CipUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const visibleRoles = profile.role === "engineer" ? users.filter((user) => user.role === "operator") : users;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleRoles
      .filter((user) => {
        const matchesQuery = !query || [user.name, user.email, user.matricule, user.department, user.workshop, user.rfidBadgeId].some((value) => value.toLowerCase().includes(query));
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        const matchesStatus = statusFilter === "all" || user.status === statusFilter;
        return matchesQuery && matchesRole && matchesStatus;
      })
      .sort((a, b) => String(b[sortKey] ?? "").localeCompare(String(a[sortKey] ?? "")));
  }, [roleFilter, search, sortKey, statusFilter, visibleRoles]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="grid gap-6">
      {notice ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{notice}</div> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#315941] dark:bg-[#0c1811] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-formital-green">Administration</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Utilisateurs</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{filtered.length} comptes visibles</p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="rounded-lg bg-formital-green px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-formital-green-dark">
            Creer un utilisateur
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["all", "Utilisateurs"],
            ["operator", "Operateurs"],
            ["engineer", "Ingenieurs"],
            ["admin", "Admins"]
          ].map(([value, label]) => {
            if (profile.role !== "admin" && value !== "all" && value !== "operator") return null;
            return (
              <button
                key={value}
                onClick={() => {
                  setRoleFilter(value);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  roleFilter === value
                    ? "bg-formital-green text-white"
                    : "border border-slate-200 text-slate-600 hover:border-formital-green hover:text-formital-green dark:border-[#315941] dark:text-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem]">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher nom, email, atelier..." className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#07170f]" />
          <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#07170f]">
            <option value="all">Tous roles</option>
            <option value="operator">Operateurs</option>
            {profile.role === "admin" ? <option value="engineer">Ingenieurs</option> : null}
            {profile.role === "admin" ? <option value="admin">Admins</option> : null}
          </select>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#07170f]">
            <option value="all">Tous etats</option>
            <option value="Actif">Actifs</option>
            <option value="Inactif">Inactifs</option>
          </select>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#07170f]">
            <option value="createdAt">Tri date</option>
            <option value="name">Tri nom</option>
            <option value="role">Tri role</option>
            <option value="status">Tri etat</option>
          </select>
        </div>
      </section>

      <div className="grid gap-3 md:hidden">
        {pageRows.map((user) => (
          <article key={user.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#315941] dark:bg-[#0c1811]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/users/${user.id}` as Route} className="truncate text-lg font-black text-slate-950 dark:text-white">{user.name}</Link>
                <p className="truncate text-sm font-semibold text-slate-500">{user.email}</p>
              </div>
              <span className={statusBadge(user.status)}>{user.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <span>Role: {roleLabel(user.role)}</span>
              <span>Atelier: {user.workshop || "-"}</span>
              <span>Matricule: {user.matricule || "-"}</span>
              <span>Tel: {user.phone || "-"}</span>
              <span>Departement: {user.department || "-"}</span>
              <span>Badge: {user.rfidBadgeId || "-"}</span>
            </div>
            <div className="mt-4">
              <UserActions
                profile={profile}
                user={user}
                onEdit={() => setEditUser(user)}
                onPassword={() => setPasswordUser(user)}
                onDelete={() => {
                  setDeleteConfirmation("");
                  setDeleteUser(user);
                }}
              />
            </div>
          </article>
        ))}
      </div>

      <section className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#315941] dark:bg-[#0c1811] md:block">
        <div className="responsive-table-shell max-h-[42rem]">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500 dark:border-[#315941] dark:bg-[#0c1811]">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Etat</th>
                <th className="px-4 py-3">Atelier</th>
                <th className="px-4 py-3">Matricule</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#214531]">
              {pageRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center font-bold text-slate-500">Aucun compte ne correspond aux filtres.</td></tr>
              ) : (
                pageRows.map((user) => (
                  <tr key={user.id} className={user.status === "Inactif" ? "opacity-60" : undefined}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${user.id}` as Route} className="font-black text-slate-950 hover:text-formital-green dark:text-white">{user.name}</Link>
                      <p className="text-xs font-semibold text-slate-500">{user.email}</p>
                      <div className="mt-2 flex max-w-[24rem] flex-wrap gap-1.5">
                        {infoChip("Tel", user.phone)}
                        {infoChip("Dept", user.department)}
                        {infoChip("RFID", user.rfidBadgeId)}
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={statusBadge(user.role)}>{roleLabel(user.role)}</span></td>
                    <td className="px-4 py-3"><span className={statusBadge(user.status)}>{user.status}</span></td>
                    <td className="px-4 py-3 font-semibold">{user.workshop || "-"}</td>
                    <td className="px-4 py-3 font-semibold">{user.matricule || "-"}</td>
                    <td className="px-4 py-3">
                      <UserActions
                        profile={profile}
                        user={user}
                        onEdit={() => setEditUser(user)}
                        onPassword={() => setPasswordUser(user)}
                        onDelete={() => {
                          setDeleteConfirmation("");
                          setDeleteUser(user);
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold dark:border-[#315941] dark:bg-[#0c1811]">
        <span>Page {safePage} / {totalPages}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40" disabled={safePage === 1}>Precedent</button>
          <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40" disabled={safePage === totalPages}>Suivant</button>
        </div>
      </div>

      {createOpen ? (
        <ModalShell title="Creer un utilisateur" subtitle="Ajout d'un compte avec role, statut et informations metier." onClose={() => setCreateOpen(false)}>
          <form action="/api/admin/users" method="post" className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input name="full_name" required minLength={2} placeholder="Nom complet" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="email" type="email" required placeholder="email@formital.com" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="password" type="password" required minLength={8} placeholder="Mot de passe temporaire" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <select name="role" defaultValue="operator" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]">
                <option value="operator">Operateur</option>
                {profile.role === "admin" ? <option value="engineer">Ingenieur</option> : null}
                {profile.role === "admin" ? <option value="admin">Admin</option> : null}
              </select>
              <input name="phone" placeholder="Telephone" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="matricule" placeholder="Matricule" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="rfid_badge_id" placeholder="Badge RFID" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="department" placeholder="Departement" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="workshop" placeholder="Atelier" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
            </div>
            <button className="min-h-11 rounded-lg bg-formital-green px-4 font-bold text-white">Creer le compte</button>
          </form>
        </ModalShell>
      ) : null}

      {editUser ? (
        <ModalShell title={`Modifier ${editUser.name}`} subtitle="Mise a jour des informations et du role autorise." onClose={() => setEditUser(null)}>
          <form action={`/api/admin/users/${editUser.id}` as Route} method="post" className="grid gap-3">
            <input type="hidden" name="action" value="update" />
            <label className="grid gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              Nom complet
              <input name="full_name" defaultValue={editUser.name} className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              Email
              <input name="email" type="email" defaultValue={editUser.email} className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                Role
                <select name="role" defaultValue={editUser.role} className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]">
                  <option value="operator">Operateur</option>
                  {profile.role === "admin" ? <option value="engineer">Ingenieur</option> : null}
                  {profile.role === "admin" ? <option value="admin">Admin</option> : null}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                Etat
                <select name="status" defaultValue={editUser.status === "Actif" ? "active" : "inactive"} className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]">
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="phone" defaultValue={editUser.phone} placeholder="Telephone" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="matricule" defaultValue={editUser.matricule} placeholder="Matricule" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="rfid_badge_id" defaultValue={editUser.rfidBadgeId} placeholder="Badge RFID" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="department" defaultValue={editUser.department} placeholder="Departement" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
              <input name="workshop" defaultValue={editUser.workshop} placeholder="Atelier" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
            </div>
            <button className="min-h-11 rounded-lg bg-formital-green px-4 text-sm font-bold text-white">Enregistrer</button>
          </form>
        </ModalShell>
      ) : null}

      {passwordUser ? (
        <ModalShell title="Reinitialiser le mot de passe" subtitle={passwordUser.email} onClose={() => setPasswordUser(null)}>
          <form action={`/api/admin/users/${passwordUser.id}` as Route} method="post" className="grid gap-3">
            <input type="hidden" name="action" value="reset_password" />
            <input name="password" type="password" minLength={8} required placeholder="Nouveau mot de passe" className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]" />
            <button className="min-h-11 rounded-lg bg-formital-green px-4 text-sm font-bold text-white">Reinitialiser</button>
          </form>
        </ModalShell>
      ) : null}

      {deleteUser ? (
        <ModalShell title="Confirmer la suppression" subtitle={`${deleteUser.name} - ${deleteUser.email}`} onClose={() => setDeleteUser(null)}>
          <form action={`/api/admin/users/${deleteUser.id}` as Route} method="post" className="grid gap-4">
            <input type="hidden" name="action" value="delete" />
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              Si le compte possede des cycles CIP, il sera archive et desactive pour conserver l&apos;historique. Sans cycles lies, il sera supprime definitivement.
            </p>
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Tapez SUPPRIMER pour confirmer
              <input
                name="confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="SUPPRIMER"
                className="min-h-11 rounded-lg border border-slate-200 px-3 dark:border-[#315941] dark:bg-[#0b1f14]"
              />
            </label>
            <button disabled={deleteConfirmation !== "SUPPRIMER"} className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">
              Supprimer ou archiver
            </button>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
