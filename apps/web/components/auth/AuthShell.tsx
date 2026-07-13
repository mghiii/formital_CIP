import type { PropsWithChildren } from "react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { FormitalLogo } from "@/components/brand/FormitalLogo";

export function AuthShell({ children }: PropsWithChildren) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7faf7] px-4 py-5 text-ink dark:bg-[#07120d] sm:px-5 sm:py-6">
      <div className="fixed right-5 top-5 z-30">
        <ThemeToggle />
      </div>
      <section className="mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-7xl items-center gap-8 lg:min-h-[calc(100vh-3rem)] lg:rounded-[1.5rem] lg:border lg:border-formital-green/20 lg:bg-white/90 lg:p-10 lg:shadow-soft lg:dark:bg-[#0b1711]/80 lg:grid-cols-[1fr_0.92fr]">
        <div className="relative hidden min-h-[680px] overflow-hidden rounded-2xl bg-white p-8 dark:bg-[#0b1711] lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(31,122,58,0.10),transparent_28%),linear-gradient(160deg,#ffffff_0%,#f2f7f1_54%,#dceee0_100%)] dark:bg-[radial-gradient(circle_at_72%_28%,rgba(84,200,120,0.14),transparent_28%),linear-gradient(160deg,#0b1711_0%,#102318_58%,#163823_100%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-44 bg-formital-green" style={{ clipPath: "polygon(0 52%, 100% 0, 100% 100%, 0% 100%)" }} />
          <div className="relative z-10 flex max-w-md flex-col">
            <FormitalLogo />
            <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight text-formital-green md:text-5xl">
              Systeme de suivi et d&apos;automatisation des operations CIP
            </h1>
            <div className="mt-8 h-1 w-16 rounded bg-formital-green" />
            <p className="mt-6 text-base leading-7 text-slate-700">
              Suivez, analysez et optimisez vos operations de nettoyage avec une interface claire pour la production,
              la qualite et la maintenance.
            </p>
            <div className="mt-9 grid gap-4">
              {[
                ["Tracabilite complete", "Historique detaille de tous les cycles CIP"],
                ["Performance optimisee", "Tableaux de bord et indicateurs en temps reel"],
                ["Conformite garantie", "Suivi des normes et exigences qualite"]
              ].map(([title, text]) => (
                <div key={title} className="flex gap-4 rounded-[10px] border border-formital-green/15 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-[#315941] dark:bg-[#102218]/80">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-formital-green text-sm font-bold text-white">OK</span>
                  <div>
                    <p className="font-bold text-formital-green">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-10 text-sm font-semibold text-white">Qualite - Securite - Performance</div>
          </div>
        </div>
        <div className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center lg:min-h-0">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-[#315941] dark:bg-[#0d1b13] sm:p-8">
            <div className="mb-7 flex justify-center text-center">
              <FormitalLogo />
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
