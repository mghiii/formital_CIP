export type AppRole = "operator" | "engineer" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: AppRole;
  rfid_badge_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthViewState = "loading" | "authenticated" | "unauthenticated" | "inactive";
