export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
  isConfigured: boolean;
};

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey)
  };
}

export function requirePublicSupabaseConfig(): Pick<PublicSupabaseConfig, "url" | "anonKey"> {
  const config = getPublicSupabaseConfig();

  if (!config.isConfigured) {
    throw new Error("Configuration publique de la base de donnees manquante.");
  }

  return {
    url: config.url,
    anonKey: config.anonKey
  };
}
