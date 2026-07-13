export default function InactivePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-ink sm:px-6">
      <section className="w-full max-w-md rounded-[1.5rem] bg-white p-6 text-center shadow-soft sm:p-8">
        <h1 className="text-2xl font-semibold">Compte inactif</h1>
        <p className="mt-3 text-muted">Votre compte est desactive. Contactez un administrateur Digital CIP.</p>
      </section>
    </main>
  );
}
