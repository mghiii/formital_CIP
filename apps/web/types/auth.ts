export type AppRole = "operator" | "engineer" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: AppRole;
  rfid_badge_id: string | null;
  phone: string | null;
  matricule: string | null;
  department: string | null;
  workshop: string | null;
  status: "active" | "inactive" | "pending" | null;
  avatar_url: string | null;
  last_sign_in_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthViewState = "loading" | "authenticated" | "unauthenticated" | "inactive";
