"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const schema = z
  .object({
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres."),
    confirmPassword: z.string()
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"]
  });

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Mot de passe invalide.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);

    if (updateError) {
      setError("Impossible de mettre a jour le mot de passe. Votre session a peut-etre expire.");
      return;
    }

    router.replace("/login");
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <h2 className="text-center text-2xl font-bold tracking-tight text-formital-green">Nouveau mot de passe</h2>
      <div className="mt-8 grid gap-5">
        <FormField id="password" label="Nouveau mot de passe" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <FormField
          id="confirmPassword"
          label="Confirmer le mot de passe"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading} className="min-h-12 bg-formital-green text-base hover:bg-formital-green-dark">
          {loading ? "Mise a jour..." : "Mettre a jour"}
        </Button>
      </div>
    </form>
  );
}
