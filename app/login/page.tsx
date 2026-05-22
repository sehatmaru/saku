import { AuthCard } from "@/features/auth/auth-card";

export default function LoginPage() {
  return (
    <main className="saku-shell saku-noise flex min-h-screen items-center justify-center bg-background p-4">
      <AuthCard mode="login" />
    </main>
  );
}
