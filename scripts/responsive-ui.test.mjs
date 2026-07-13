import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("responsive UI Digital CIP", () => {
  it("utilise un AppShell mobile-first avec header compact et bottom navigation", () => {
    const shell = read("apps/web/components/app/AppShell.tsx");

    assert.match(shell, /min-h-dvh/);
    assert.match(shell, /env\(safe-area-inset-top\)/);
    assert.match(shell, /env\(safe-area-inset-bottom\)/);
    assert.match(shell, /Navigation principale mobile/);
    assert.match(shell, /bottomNavItems/);
    assert.match(shell, /lg:hidden/);
  });

  it("affiche uniquement le formulaire de connexion sur mobile", () => {
    const authShell = read("apps/web/components/auth/AuthShell.tsx");

    assert.match(authShell, /max-w-md/);
    assert.match(authShell, /lg:max-w-7xl/);
    assert.match(authShell, /hidden .*lg:flex/);
    assert.match(authShell, /100dvh/);
    assert.doesNotMatch(authShell, /min-h-screen/);
  });

  it("borne les tableaux et transforme les modales en bottom sheet mobile", () => {
    const detailsTable = read("apps/web/components/app/CycleDetailsTable.tsx");
    const addEquipment = read("apps/web/components/app/AddEquipmentModal.tsx");
    const checklist = read("apps/web/components/app/ChecklistPreviewModal.tsx");
    const views = read("apps/web/components/app/CipViews.tsx");
    const modal = read("apps/web/components/app/AllCyclesGraphModal.tsx");
    const globals = read("apps/web/app/globals.css");

    assert.match(detailsTable, /md:hidden/);
    assert.match(detailsTable, /max-h-\[30rem\]/);
    assert.match(detailsTable, /responsive-table-shell/);
    assert.match(detailsTable, /place-items-end/);
    assert.match(detailsTable, /sm:place-items-center/);
    assert.match(addEquipment, /place-items-end/);
    assert.match(checklist, /max-h-\[92dvh\]/);
    assert.match(views, /responsive-table-shell hidden md:block/);
    assert.match(modal, /responsive-table-shell rounded-lg/);
    assert.match(globals, /overflow-x: hidden/);
    assert.match(globals, /\.responsive-table-shell/);
    assert.doesNotMatch(detailsTable, /max-h-\[34rem\]/);
  });

  it("rend le dashboard plus dense sans tableaux redondants", () => {
    const views = read("apps/web/components/app/CipViews.tsx");

    assert.match(views, /min-h-\[22rem\]/);
    assert.match(views, /lg:min-h-\[26rem\]/);
    assert.match(views, /min-h-\[18rem\]/);
    assert.match(views, /responsive-card-scroll/);
    assert.match(views, /showRecentCycles = true/);
    assert.match(views, /showRecentCycles=\{false\}/);
    assert.match(views, /min-w-0 overflow-hidden/);
  });

  it("rend le graphe complet accessible et lisible en popup responsive", () => {
    const modal = read("apps/web/components/app/AllCyclesGraphModal.tsx");
    const charts = read("apps/web/components/app/SimpleCharts.tsx");

    assert.match(modal, /max-w-7xl/);
    assert.match(modal, /max-h-\[92dvh\]/);
    assert.match(modal, /aria-label=\{`\$\{cycle\.equipment\}/);
    assert.match(modal, /Tous les cycles affiches/);
    assert.match(charts, /sm:min-h-\[20rem\]/);
  });
});
