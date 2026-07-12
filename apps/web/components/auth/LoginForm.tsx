"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { getRoleHomePath, getSafeRedirectPath } from "@/lib/auth/roles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/auth";

const loginSchema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: z.string().min(1, "Le mot de passe est obligatoire.")
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadProfile(userId: string) {
    const supabase = createBrowserSupabaseClient();
    const { data, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single();

    if (!profileError && data) {
      return data as Profile;
    }

    const response = await fetch("/api/auth/profile-bootstrap", { method: "POST" });
    const payload = (await response.json().catch(() => null)) as { profile?: Profile; message?: string } | null;

    if (!response.ok || !payload?.profile) {
      throw new Error(payload?.message ?? "Profil introuvable. Contactez un administrateur.");
    }

    return payload.profile;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword(parsed.data);

      if (signInError || !data.user) {
        setError("Identifiants incorrects ou compte indisponible.");
        return;
      }

      if (!remember) {
        await supabase.auth.setSession(data.session);
      }

      const typedProfile = await loadProfile(data.user.id);
      if (!typedProfile.is_active) {
        router.replace("/inactive");
        return;
      }

      const next = searchParams.get("next");
      router.refresh();
      router.replace(getSafeRedirectPath(next, getRoleHomePath(typedProfile.role)));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <h2 className="text-center text-3xl font-bold tracking-tight text-formital-green">Connexion</h2>
      <p className="mt-2 text-center text-sm leading-6 text-muted">Connectez-vous a votre compte</p>
      <div className="mt-8 grid gap-5">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormField
          id="password"
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <label className="flex items-center gap-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          Se souvenir de moi sur cet appareil
        </label>
        {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading} className="min-h-14 bg-formital-green text-base hover:bg-formital-green-dark">
          {loading ? "Connexion..." : "Se connecter ->"}
        </Button>
      </div>
      <div className="mt-6 flex items-center justify-between gap-4 text-sm">
        <Link href="/forgot-password" className="font-semibold text-primary">
          Mot de passe oublie
        </Link>
        <span className="text-right text-muted">RFID prevu pour une phase materielle future</span>
      </div>
    </form>
  );
}
