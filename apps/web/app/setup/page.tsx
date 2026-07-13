export default function SetupPage() {
  return (
    <main className="min-h-dvh bg-slate-950 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-white sm:px-6">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">Digital CIP</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Configuration base de donnees requise</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
          L&apos;application est lancee, mais elle attend encore la configuration publique de la base de donnees. Cette cle est
          publique pour le navigateur. Ne mets jamais une cle secrete dans le frontend.
        </p>
        <div className="mt-8 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-5 font-mono text-sm leading-7 text-slate-100">
          <p>Fichier a completer :</p>
          <p className="mt-2 text-teal-300">.env.local</p>
          <p className="mt-4">Ajoute l&apos;URL publique de la base de donnees.</p>
          <p>Ajoute la cle publique de connexion.</p>
        </div>
        <p className="mt-6 text-sm leading-6 text-slate-400">
          Apres modification, redemarre le serveur avec pnpm dev.
        </p>
      </section>
    </main>
  );
}
