"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Adresse email invalide.")
});

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Email invalide.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const origin = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/reset-password`
    });
    setLoading(false);

    if (resetError) {
      setError("Impossible d'envoyer l'email de reinitialisation.");
      return;
    }

    setMessage("Si ce compte existe, un email de reinitialisation vient d'etre envoye.");
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-[1.5rem] bg-white p-6">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Mot de passe oublie</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Recevez un lien securise pour choisir un nouveau mot de passe.</p>
      <div className="mt-8 grid gap-5">
        <FormField id="email" label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
        {message ? <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-medium text-primary">{message}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Envoi..." : "Envoyer le lien"}
        </Button>
      </div>
    </form>
  );
}
