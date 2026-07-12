import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { redirectAuthenticatedUser } from "@/lib/auth/session";

export default async function LoginPage() {
  await redirectAuthenticatedUser();

  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
