export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6 text-ink">
      <section className="max-w-md rounded-[1.5rem] bg-white p-8 text-center shadow-soft">
        <h1 className="text-2xl font-semibold">Acces refuse</h1>
        <p className="mt-3 text-muted">Vous n'avez pas l'autorisation d'acceder a cette page.</p>
      </section>
    </main>
  );
}
